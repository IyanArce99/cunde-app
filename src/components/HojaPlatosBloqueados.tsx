import BottomSheet from './BottomSheet';
import PrimaryButton from './PrimaryButton';
import { nombresDeBloqueados } from '../lib/preferencias';
import type { PreferenciasPlatos } from '../lib/preferencias';
import './HojaPlatosBloqueados.css';
import './AjustesSemana.css';

interface HojaPlatosBloqueadosProps {
  preferenciasPlatos: PreferenciasPlatos;
  onPermitir: (platoId: string, tipo: 'receta' | 'ensamblaje') => void;
  onCerrar: () => void;
}

/**
 * ═══ PLATOS QUE NO QUIERES ═══
 *
 * Una lista y un botón por fila. Nada más.
 *
 * El encargo lo dice y conviene repetirlo aquí: esto NO es una pantalla de
 * favoritos. La necesidad que resuelve es concreta y estrecha —he bloqueado un
 * plato sin querer, o cambié de idea, y quiero volver a permitirlo—, y montar
 * encima una biblioteca de gustos con secciones y contadores convertiría una
 * corrección de dos toques en un sitio donde hay que buscar.
 *
 * Los favoritos no salen. No porque no importen, sino porque no hay nada que
 * arreglar en ellos: un favorito de más no rompe ninguna semana, y quien quiera
 * quitarlo lo hace desde el mismo plato. El día que haya algo que hacer con
 * ellos —verlos juntos, ordenarlos— tendrá su sitio.
 *
 * ═══ LOS QUE YA NO EXISTEN ═══
 *
 * Un id guardado puede no estar en el recetario de hoy: la receta se retiró, se
 * renombró el id, o el usuario viene de una versión con otro catálogo. Esos
 * NO se esconden — se enseñan al final, dichos como lo que son. Esconderlos
 * dejaría al usuario con un contador de "3 platos" y una lista de 2, que es de
 * las cosas que hacen desconfiar de una app; y borrarlos por su cuenta sería
 * perder una preferencia que quizá vuelva a servir.
 */
const HojaPlatosBloqueados: React.FC<HojaPlatosBloqueadosProps> = ({
  preferenciasPlatos, onPermitir, onCerrar,
}) => {
  const platos = nombresDeBloqueados(preferenciasPlatos);

  return (
    <BottomSheet onDismiss={onCerrar}>
      <div className="ajustes__cabecera">
        <span className="ajustes__titulo-hoja">Platos que no quieres</span>
        <button type="button" className="ajustes__cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ✕
        </button>
      </div>

      {platos.length === 0 ? (
        <p className="bloqueados__vacio">
          Ninguno. Los platos que marques como «no, gracias» aparecen aquí para poder devolverlos.
        </p>
      ) : (
        <>
          <p className="bloqueados__intro">
            No salen en las semanas que genero. Devuelve el que quieras: entra en la siguiente.
          </p>
          <div className="bloqueados__lista">
            {platos.map((p) => (
              <div className="bloqueados__fila" key={p.id}>
                <span className="bloqueados__texto">
                  <span className={`bloqueados__nombre${p.existe ? '' : ' bloqueados__nombre--ido'}`}>
                    {p.nombre}
                  </span>
                  {!p.existe && (
                    <span className="bloqueados__meta">ya no está en el recetario</span>
                  )}
                </span>
                <button
                  type="button"
                  className="bloqueados__permitir"
                  onClick={() => onPermitir(p.id, p.tipo)}
                >
                  Permitir
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <PrimaryButton onClick={onCerrar}>Listo</PrimaryButton>
    </BottomSheet>
  );
};

export default HojaPlatosBloqueados;
