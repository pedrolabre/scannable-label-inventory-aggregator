import { cx } from '../../lib/cx.js';
import { buttonShapeClasses } from '../ui/Button.jsx';
import { INNER_FOCUS_OUTLINE, INNER_FOCUS_OUTLINE_COLORS } from '../ui/focusClasses.js';

import useImageIntake from './useImageIntake.js';

/**
 * Os dois caminhos de entrada de foto, com a orientacao de enquadramento logo
 * abaixo, na hora em que ela serve. Cada seletor mora dentro de um rotulo
 * com a forma de botao e fica escondido so visualmente: continua alcancavel
 * pelo teclado, com uma parada de tabulacao so, e o nome dele e o texto do
 * rotulo. O realce de foco aparece no rotulo.
 */

const PICKER_CLASSES = 'min-w-0 text-center';

export default function CaptureButtons({ enqueue }) {
  const { onCameraChange, onFilesChange } = useImageIntake(enqueue);

  return (
    <section aria-labelledby="capture-title" className="space-y-3">
      <h3 id="capture-title" className="text-rotulo font-semibold text-neutro-tintaMedia">
        Fotos das etiquetas
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <label
          className={cx(
            buttonShapeClasses('primary'),
            INNER_FOCUS_OUTLINE,
            INNER_FOCUS_OUTLINE_COLORS.brand,
            PICKER_CLASSES,
          )}
        >
          Fotografar
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onCameraChange}
          />
        </label>

        <label
          className={cx(
            buttonShapeClasses('secondary'),
            INNER_FOCUS_OUTLINE,
            INNER_FOCUS_OUTLINE_COLORS.neutral,
            PICKER_CLASSES,
          )}
        >
          Enviar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onFilesChange}
          />
        </label>
      </div>

      <p data-orientacao="" className="text-rotulo font-semibold text-neutro-tintaMedia">
        Enquadre a folha de frente, inteira e nítida.
      </p>

      <p className="text-rotulo text-neutro-tintaFraca">
        Fotografar abre a câmera para uma foto. Enviar fotos escolhe várias imagens de uma vez.
      </p>
    </section>
  );
}
