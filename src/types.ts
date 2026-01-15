/**
 * 2D coordinate with numeric `x` and `y` properties.
 */
export type Coordinate = Record<'x' | 'y', number>


export type ModalStyleOptions = Partial<{
  position: CSSStyleDeclaration["position"];
  top: string;
  right: string;
  left: string;
  bottom: string;
  zIndex: string;
  backgroundColor: string;
  border: string;
  borderRadius: string;
  padding: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  boxShadow: string;
}>;
