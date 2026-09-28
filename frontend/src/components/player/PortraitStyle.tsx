import { createContext, useContext, type ReactNode } from 'react';

/**
 * Estilo das fotos numa região da tela:
 *  - square: foto quadrada (biblioteca, temporadas);
 *  - framed: retrato vertical com moldura dourada, como a parede do reality (simulação).
 */
export type PortraitStyle = 'square' | 'framed';

const PortraitStyleContext = createContext<PortraitStyle>('square');

export function PortraitStyleProvider({ value, children }: Readonly<{ value: PortraitStyle; children: ReactNode }>) {
  return <PortraitStyleContext.Provider value={value}>{children}</PortraitStyleContext.Provider>;
}

export function usePortraitStyle(): PortraitStyle {
  return useContext(PortraitStyleContext);
}
