/** Menus for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports
import { Menu } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';

// Custom imports
import { TITLE_PLAIN } from './utils';

export let bookmarksMainMenu: Menu;
/**
 * Initializes the menu instance for the plugin for JupyterLab main menu.
 * @param commands - `CommandRegistry` instance to initialize the menu with. Practially the commands for the app.
 */
export function initBookmarksMainMenu(commands: CommandRegistry): Menu {
  if (bookmarksMainMenu === undefined) {
    bookmarksMainMenu = new Menu({ commands });
    bookmarksMainMenu.title.label = TITLE_PLAIN;
  }
  return bookmarksMainMenu;
}

/**
 * Returns the Menu for the plugin that is in the JupyterLab menu.
 */
export function getBookmarksMainMenu(): Menu {
  return bookmarksMainMenu;
}
