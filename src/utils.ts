/** Utilities for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { InputDialog, showErrorMessage } from '@jupyterlab/apputils';
import { IDisposable } from '@lumino/disposable';
import { Menu } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { notebookIcon } from '@jupyterlab/ui-components';
import { ILauncher } from '@jupyterlab/launcher';
import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { requestAPI } from './jupyterlab-bookmarks-extension';

// Custom imports
import { getBookmarksMainMenu } from './menus';
import { Bookmark } from './bookmark';

//Global vars and exports
export const commandPrefix = 'jupyterlab-bookmarks-extension:';
export const VERSION = '0.5.5';
export const TITLE_PLAIN = 'Bookmarks';
export const TITLE_MANAGEMENT = `${TITLE_PLAIN} - Management - ${VERSION}`;
export const TITLE = `${TITLE_PLAIN} - ${VERSION}`;
export const DISABLED_TITLE = `Disabled bookmarks - ${VERSION}`;
export const NOTEBOOK_FACTORY = 'Notebook';

// non exported variables
let settingsObject: ISettingRegistry.ISettings = null;

// OLD [[name, path in current JL root, absolute_path, temp_path, disabled]]
/**
 * Data structure is Map<string, Bookmark> => {title: Bookmark}
 */
//let bookmarks: Array<Array<string>> = new Array<Array<string>>();
let bookmarks: Map<string, Bookmark> = new Map<string, Bookmark>();

// exported variables
export const bookmarkCommands: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();
export const bookmarkLaunchers: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();

export const bookmarkMenuItems: Map<string, Menu.IItem> = new Map<
  string,
  Menu.IItem
>();

export let categories: Array<string> = new Array<string>();

//exported methods
/**
 * Load the settings for this extension
 *
 * @param settings Extension settings
 */
export function loadSetting(settings: ISettingRegistry.ISettings): void {
  // Read the settings and convert to the correct type
  bookmarks = new Map(settings.get('bookmarks').composite as Array<
    [string, Bookmark]
  >);
}

export function setBookmarks(incomingBookmarks: Map<string, Bookmark>): void {
  bookmarks = incomingBookmarks;
}

export function getBookmarks(): Map<string, Bookmark> {
  return bookmarks;
}

export function getSettingsObject(): ISettingRegistry.ISettings {
  return settingsObject;
}
export function setSettingsObject(
  incomingSettingsObject: ISettingRegistry.ISettings
): void {
  settingsObject = incomingSettingsObject;
}

/**
 * Updates the JupyterLab apps `commands` variable with the command that is assigned to launch the bookmark.
 * @param commands - The `CommandRegistry` instance to add the command to.
 * @param bookmarkItem - `string[]` that has the information about the bookmark.
 * @returns `void`
 */
export function updateCommands(
  commands: CommandRegistry,
  bookmarkItem: Bookmark
): void {
  const commandId: string = bookmarkItem.title;
  const disabled = bookmarkItem.disabled === true;
  if (commands.hasCommand(commandPrefix + commandId)) {
    const commandToDelete = bookmarkCommands.get(commandId);
    if (commandToDelete !== undefined) {
      commandToDelete.dispose();
      bookmarkCommands.delete(commandId);
    }
  }
  const commandPath: string =
    bookmarkItem.activePath === bookmarkItem.basePath
      ? bookmarkItem.basePath
      : bookmarkItem.activePath;
  const commandDisposable = commands.addCommand(commandPrefix + commandId, {
    label: commandId,
    caption: commandId,
    icon: notebookIcon,
    execute: async () => {
      if (disabled) {
        return window.alert(
          `This bookmark is currently unavailable.\nMake sure that ${
            bookmarkItem.absPath
          } is accessible.`
        );
      }
      return commands.execute('docmanager:open', {
        path: commandPath,
        factory: NOTEBOOK_FACTORY
      });
    }
  });
  bookmarkCommands.set(commandId, commandDisposable);
}

/**
 * Update the plugin's settings with the bookmark.
 * @async
 * @param bookmarkItem - `Bookmark` that stores the bookmark to be saved to the settings.
 * @returns `Promise<void>`
 */
export async function updateSettings(bookmarkItem?: Bookmark): Promise<void> {
  if (bookmarkItem) {
    bookmarks.set(bookmarkItem.title, bookmarkItem);
  }
  await settingsObject.set(
    'bookmarks',
    JSON.parse(JSON.stringify(Array.from(bookmarks.entries())))
  );
}

/**
 * Updates the `Launcher` with the bookmark.
 * @param launcher - The `Launcher` instance to update.
 * @param bookmarkItem - string[] that holds the bookmark to add.
 * @returns `void`
 */
export function updateLauncher(
  launcher: ILauncher,
  bookmarkItem: Bookmark
): void {
  const commandId: string = bookmarkItem.title;
  const disabled = bookmarkItem.disabled === true;
  const launcherItem: IDisposable = launcher.add({
    command: commandPrefix + commandId,
    category: disabled ? DISABLED_TITLE : TITLE
  });
  bookmarkLaunchers.set(commandId, launcherItem);
}

/**
 * Updates the plugin's menu with the bookmark.
 * @param bookmarkItem - string[] that holds the bookmark to add.
 * @returns `void`
 */
export function updateMenu(bookmarkItem: Bookmark): void {
  const commandId: string = bookmarkItem.title;
  const bookmarkMenuItem = getBookmarksMainMenu().addItem({
    type: 'command',
    command: commandPrefix + commandId
  });
  bookmarkMenuItems.set(commandId, bookmarkMenuItem);
}

/**
 * Deletes the bookmark, and updates the `Launcher` the `Menu` and the `commands`.
 * @async
 * @param bookmarkToDelete - `string[]` the bookmark to delete.
 * @returns `Promise<void>
 */
export async function deleteBookmark(bookmarkToDelete: string): Promise<void> {
  bookmarkLaunchers.get(bookmarkToDelete).dispose();
  bookmarkLaunchers.delete(bookmarkToDelete);
  bookmarkCommands.get(bookmarkToDelete).dispose();
  bookmarkCommands.delete(bookmarkToDelete);
  getBookmarksMainMenu().removeItem(bookmarkMenuItems.get(bookmarkToDelete));
  bookmarkMenuItems.delete(bookmarkToDelete);
  bookmarks.delete(bookmarkToDelete);
  await settingsObject.set(
    'bookmarks',
    JSON.parse(JSON.stringify(Array.from(bookmarks.entries())))
  );
}

/** Adds a `bookmarkItem`, to the `commands` list, to the Launcher and to the Bookmarks menu.
 * @async
 * @param commands - A `CommandRegistry` instance that holds the commands registered in the JL app.
 * @param launcher - The `Launcher` instance to add the bookmark to.
 * @param bookmarkItem - `string[]`. The bookmarkItem to be added.
 * @param skipDuplicateCheck - `boolean`. Optional parameter to skip or not to skip
 * duplicate check.
 * @returns `Promise<boolean>`
 */
export async function addBookmark(
  commands: CommandRegistry,
  launcher: ILauncher,
  bookmarkItem: Bookmark,
  skipDuplicateCheck?: boolean,
  startup?: boolean
): Promise<boolean> {
  if (!skipDuplicateCheck) {
    const bookmarkName = bookmarkItem.title;
    //const bookmarkAbsPath = bookmarkItem[2];
    if (bookmarks.has(bookmarkName)) {
      // if we have a bookmark with the same title we have to check for paths to see if they are the same or not.
      if (bookmarkItem.absPath === bookmarks.get(bookmarkName).absPath) {
        showErrorMessage(
          'Duplicate entry',
          'The bookmark already exists. Not saving.'
        );
        return false;
      }
      return await InputDialog.getItem({
        title: `Bookmark with name: "${bookmarkName}" already exists. What would you like to do?`,
        items: ['Overwrite', 'Save as new']
      }).then(
        async (result): Promise<boolean> => {
          if (result.button.label === 'Cancel') {
            return false;
          }
          if (result.value === 'Overwrite') {
            // we delete the old entry and save it as new.
            await deleteBookmark(bookmarkName);
            updateCommands(commands, bookmarkItem);
            updateLauncher(launcher, bookmarkItem);
            updateMenu(bookmarkItem);
            updateSettings(bookmarkItem);
            return true;
          }

          if (result.value === 'Save as new') {
            // we append a (1), (2) etc after it
            let numberOfCopies = 0;
            bookmarks.forEach(bookmark => {
              if (
                bookmark.absPath.split('/').slice(-1)[0] ===
                bookmarkItem.absPath.split('/').slice(-1)[0]
              ) {
                numberOfCopies++;
              }
            });
            bookmarkItem.title = `${
              bookmarkItem.title.split('.')[0]
            }_(${numberOfCopies}).${bookmarkItem.title.split('.')[1]}`;
            updateCommands(commands, bookmarkItem);
            updateLauncher(launcher, bookmarkItem);
            updateMenu(bookmarkItem);
            updateSettings(bookmarkItem);
            return true;
          }
        }
      );
    }  
  }
  // if duplicate check is false or no duplicate found we just save as is.
  updateCommands(commands, bookmarkItem);
  updateLauncher(launcher, bookmarkItem);
  updateMenu(bookmarkItem);
  if (!startup) {
    updateSettings(bookmarkItem);
  }

  return true;
}

/**
 * Adds a bookmark item from the context menu of an open notebook.
 * @async
 * @param commands - A `CommandRegistry` instance that holds the commands registered in the JL app.
 * @param launcher - The `Launcher` instance to add the bookmark to.
 * @param currentDocName - `string` the name of the open notebbook
 * @param currentDocPath - `string` the path of the open notebook
 * @returns `Promise<void>`
 */
export async function addBookmarkItem(
  commands: CommandRegistry,
  launcher: ILauncher,
  currentDocName: string,
  currentDocPath: string
): Promise<void> {
  const bookmarkItemJSON = await requestAPI<any>('getAbsPath', {
    method: 'POST',
    body: JSON.stringify(
      new Bookmark(currentDocName, currentDocPath, '', '', false, '')
    )
  });
  if (!bookmarkItemJSON.error) {
    const bookmarkItem: Bookmark = bookmarkItemJSON.bookmarkItem;
    addBookmark(commands, launcher, bookmarkItem);
  } else {
    window.alert(`Failed to save bookmark.\n${bookmarkItemJSON.reason}`);
  }
}

/**
 * Synchronises a notebook that has been opened from a temporary location back to it's original instance when the file is saved.
 * Makes a HTTP call to the plugins server extension that does the actual copying.
 * @param bookmarkedNotebookModel - `DocumentRegistry.IContext<INotebookModel>` the context object for the current NotebookWdiget.
 */
export function syncBookmark(
  bookmarkedNotebookModel: DocumentRegistry.IContext<INotebookModel>
): void {
  const bookmarkEntries = Array.from(bookmarks.entries());
  for (let i = 0; i < bookmarkEntries.length; i++) {
    if (
      bookmarkEntries[i][1].activePath.startsWith('.tmp') &&
      bookmarkEntries[i][1].absPath === bookmarkedNotebookModel.path
    ) {
      //Once we find the bookmark that corresponds to the file that has been saved we make a request to the server to sync and exit the loop.
      requestAPI<any>('syncBookmark', {
        method: 'POST',
        body: JSON.stringify(bookmarkEntries[i][1])
      })
        .then(result => {
          if (!result.success) {
            window.alert(
              `Failed to autosync for ${bookmarkEntries[i][1].title}.\n${
                result.reason
              }`
            );
          }
        })
        .catch(error => {
          window.alert(
            `Failed to autosync for ${bookmarkEntries[i][1].title}.\n${error}`
          );
        });
      break;
    }
  }
}

/**
 * Sets up the autosyncing for a notebook, by connecting the `syncBookmark` function to the notebook's context's fileChanged signal.
 * @param notebookPanel - `NotebookPanel`, the widget hosting the notebook.
 * @param notebookTracker - `INotebookTracker` instance as the sender
 */
export function addAutoSyncToBookmark(
  notebookTracker: INotebookTracker,
  notebookPanel: NotebookPanel
): void {
  const bookmarkEntries = Array.from(bookmarks.entries());
  for (let i = 0; i < bookmarkEntries.length; i++) {
    if (
      bookmarkEntries[i][1].activePath.startsWith('.tmp') &&
      bookmarkEntries[i][1].absPath === notebookPanel.context.path
    ) {
      // If we find the file that needs to be synced we connect the appropriate function and exit the loop
      notebookPanel.context.fileChanged.connect(syncBookmark);
      break;
    }
  }
}

export function addCategory( categoryToAdd: string) : void{
  if (!categories.find( category => category === categoryToAdd) ){
    categories.push(categoryToAdd);
  } else {
    showErrorMessage(
      'Duplicate category',
      `Category "${categoryToAdd}" already exists. Not adding.`,
    );
  }
}

export function deleteCategory(categoryToDelete: string){
  const updatedCategories : Array<string> = new Array<string>();
  categories.forEach(category => {
    if (category === categoryToDelete){
      updatedCategories.push(category);
    }
  });
  categories = updatedCategories;
}