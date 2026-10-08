/** motion mode, auto follows prefers-reduced-motion, the getter reports the mode in effect (calm or full) */
export type GooMotionMode = 'calm' | 'full' | 'auto';

/** decorate one element, needs a button or role="button", elements with data-goo-skip are ignored */
export function attach(host: Element): void;
/** undo attach, restores the original children and removes every listener and observer */
export function detach(host: Element): void;
/** decorate every [data-goo] under root (default document), use it for shadow roots */
export function attachAll(root?: ParentNode): void;

export interface GooButtonApi {
  attach: typeof attach;
  detach: typeof detach;
  attachAll: typeof attachAll;
  /** global motion mode, reads the mode in effect, accepts auto to follow the system again */
  get motion(): 'calm' | 'full';
  set motion(mode: GooMotionMode);
}

export const GooButton: GooButtonApi;
export default GooButton;