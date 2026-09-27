/**
 * Sobreposicao entre as caixas de dois simbolos da mesma imagem.
 *
 * A caixa e o quadrilatero dos quatro cantos entregues pelo leitor, em pixels.
 * A etiqueta fotografada de lado aparece inclinada, entao a conta usa o proprio
 * quadrilatero, e nao o retangulo alinhado que o envolve: o retangulo cresce
 * com a inclinacao e faria duas etiquetas vizinhas parecerem sobrepostas.
 *
 * A medida e a intersecao sobre a uniao (IoU): a area comum dividida pela area
 * coberta pelas duas caixas, de 0 (disjuntas) a 1 (iguais).
 */

const CORNERS = Object.freeze(['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);

function cross(origin, a, b) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

/**
 * Envoltoria convexa em sentido anti-horario, sem pontos repetidos nem
 * alinhados. Os cantos do leitor ja formam um quadrilatero convexo; a
 * envoltoria so garante a mesma orientacao nas duas caixas, qualquer que seja
 * a ordem dos cantos, e desfaz um quadrilatero que se cruza.
 */
function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower = [];
  const upper = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  for (const point of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area do poligono pela formula do laco; zero para menos de tres pontos. */
function polygonArea(polygon) {
  let doubled = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];

    doubled += current.x * next.y - next.x * current.y;
  }

  return Math.abs(doubled) / 2;
}

/** Ponto em que o segmento `from`-`to` cruza a reta da aresta `start`-`end`. */
function edgeCrossing(from, to, start, end) {
  const fromSide = cross(start, end, from);
  const toSide = cross(start, end, to);
  const ratio = fromSide / (fromSide - toSide);

  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

/**
 * Parte do poligono `subject` que fica dentro do poligono convexo `clip`,
 * recortando aresta por aresta (Sutherland-Hodgman). Os dois em sentido
 * anti-horario.
 */
function clipPolygon(subject, clip) {
  let output = subject;

  for (let index = 0; index < clip.length && output.length > 0; index += 1) {
    const start = clip[index];
    const end = clip[(index + 1) % clip.length];
    const input = output;

    output = [];

    for (let current = 0; current < input.length; current += 1) {
      const point = input[current];
      const previous = input[(current + input.length - 1) % input.length];
      const pointInside = cross(start, end, point) >= 0;
      const previousInside = cross(start, end, previous) >= 0;

      if (pointInside) {
        if (!previousInside) {
          output.push(edgeCrossing(previous, point, start, end));
        }
        output.push(point);
      } else if (previousInside) {
        output.push(edgeCrossing(previous, point, start, end));
      }
    }
  }

  return output;
}

/** Os quatro cantos da posicao gravada como poligono convexo. */
export function positionPolygon(position) {
  return convexHull(CORNERS.map((corner) => position[corner]));
}

/** Area da caixa do simbolo, em pixels quadrados. */
export function positionArea(position) {
  return polygonArea(positionPolygon(position));
}

/**
 * Intersecao sobre uniao das duas caixas, de 0 a 1. Caixa sem area (cantos
 * repetidos ou alinhados) nao se sobrepoe a nada e da 0, sem divisao por zero.
 */
export function intersectionOverUnion(first, second) {
  const firstPolygon = positionPolygon(first);
  const secondPolygon = positionPolygon(second);
  const firstArea = firstPolygon.length < 3 ? 0 : polygonArea(firstPolygon);
  const secondArea = secondPolygon.length < 3 ? 0 : polygonArea(secondPolygon);

  if (firstArea === 0 || secondArea === 0) {
    return 0;
  }

  const intersection = polygonArea(clipPolygon(firstPolygon, secondPolygon));
  const union = firstArea + secondArea - intersection;

  return Math.min(1, Math.max(0, intersection / union));
}
