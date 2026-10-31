/**
 * The shared-element pair behind the theater: the hero's frame and the theater's screen each sit
 * in a <ViewTransition> with these props. Opening the theater hides one and shows the other in a
 * single transition, so React morphs the frame into the screen, and back on close. `default:
 * 'none'` keeps either side still in every other transition on the page; the morph's timing and
 * its crop are in arrival.module.css.
 */
export const morph = {
  name: 'arrival-film',
  share: 'arrival-morph',
  default: 'none',
} as const;

/**
 * Marks a server-rendered control inside the theater that closes it, such as its Close button
 * and the end plate's last line. The shell handles their clicks on the dialog.
 */
export const closesTheater = { 'data-close': '' } as const;

/**
 * Marks the theater's "Scene by scene" button, which opens the dialog nested in the theater. The
 * shell handles its clicks on the dialog too, so the scenes open even if the player can't load.
 */
export const opensScenes = { 'data-scenes': '' } as const;
