/**
 * Eventos do React (onClick, onSubmit...) esperam uma função que não devolve nada.
 * Envolve uma ação assíncrona para que o evento dispare sem deixar uma promise solta
 * (os erros das chamadas à API já viram aviso em `useAction`).
 */
export function fireAndForget<A extends unknown[]>(action: (...args: A) => Promise<unknown> | void): (...args: A) => void {
  return (...args) => {
    void action(...args);
  };
}
