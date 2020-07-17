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

//Global vars and exports
export const commandPrefix = 'jupyterlab-bookmarks-extension:';
export const VERSION = '0.5.1';
export const TITLE_PLAIN = 'Bookmarks';
export const TITLE = `${TITLE_PLAIN} - ${VERSION}`;
export const DISABLED_TITLE = `Disabled bookmarks - ${VERSION}`;
export const NOTEBOOK_FACTORY = 'Notebook';
let settingsObject: ISettingRegistry.ISettings = null;

/**
 * Data structure is Array of arrays => [[name, path in current JL root, absolute_path, temp_path, disabled]]
 */
let bookmarks: Array<Array<string>> = new Array<Array<string>>();

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

//exported methods
/**
 * Load the settings for this extension
 *
 * @param settings Extension settings
 */
export function loadSetting(settings: ISettingRegistry.ISettings): void {
  // Read the settings and convert to the correct type
  bookmarks = settings.get('bookmarks').composite as Array<Array<string>>;
}

export function setBookmarks(incomingBookmarks: Array<Array<string>>): void {
  bookmarks = incomingBookmarks;
}
export function getBookmarks(): Array<Array<string>> {
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
  bookmarkItem: string[],
  skipDuplicateCheck?: boolean
): Promise<boolean> {
  if (!skipDuplicateCheck) {
    const bookmarkName = bookmarkItem[0];
    const bookmarkAbsPath = bookmarkItem[2];
    for (let i = 0; i < bookmarks.length; i++) {
      const currentBookmark = bookmarks[i];
      if (bookmarkName === currentBookmark[0]) {
        /* we have an incoming bookmark with an existing name
                 we check if the absolute paths are the same. if yes then the two items are identical,
                 and we don't save it as it already exists we just propt the user.
                 if the abs paths are not the same we ask the user it should be saved with as a separate item 
                 or the existing entry should be updated
                */
        if (bookmarkAbsPath === currentBookmark[2]) {
          //these are identical.
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
              console.log(commandPrefix + bookmarkItem[0] + ' was overwritten');
              return true;
            }

            if (result.value === 'Save as new') {
              // we append a (1), (2) etc after it
              let numberOfCopies = 0;
              bookmarks.forEach(item => {
                if (
                  item[2].split('/').slice(-1)[0] ===
                  bookmarkItem[2].split('/').slice(-1)[0]
                ) {
                  numberOfCopies++;
                }
              });
              bookmarkItem[0] = `${
                bookmarkItem[0].split('.')[0]
              }_(${numberOfCopies}).${bookmarkItem[0].split('.')[1]}`;
              updateCommands(commands, bookmarkItem);
              updateLauncher(launcher, bookmarkItem);
              updateMenu(bookmarkItem);
              updateSettings(bookmarkItem);
              console.log(
                commandPrefix + bookmarkItem[0] + ' added to Launcher'
              );
              return true;
            }
          }
        );
      }
    }
  }
  // if duplicate check is false or no duplicate found we just save as is.
  updateCommands(commands, bookmarkItem);
  updateLauncher(launcher, bookmarkItem);
  updateMenu(bookmarkItem);
  updateSettings(bookmarkItem);
  console.log(commandPrefix + bookmarkItem[0] + ' added to Launcher');
  return true;
}

/**
 * Updates the JupyterLab apps `commands` variable with the command that is assigned to launch the bookmark.
 * @param commands - The `CommandRegistry` instance to add the command to.
 * @param bookmarkItem - `string[]` that has the information about the bookmark.
 * @returns `void`
 */
export function updateCommands(
  commands: CommandRegistry,
  bookmarkItem: string[]
): void {
  const commandId: string = bookmarkItem[0];
  const disabled = bookmarkItem[4] === 'True';
  if (commands.hasCommand(commandPrefix + commandId)) {
    const commandToDelete = bookmarkCommands.get(commandId);
    if (commandToDelete !== undefined) {
      commandToDelete.dispose();
      bookmarkCommands.delete(commandId);
    }
  }
  const commandPath: string =
    bookmarkItem[1] === bookmarkItem[3] ? bookmarkItem[1] : bookmarkItem[3];
  const commandDisposable = commands.addCommand(commandPrefix + commandId, {
    label: commandId,
    caption: commandId,
    icon: notebookIcon,
    execute: async () => {
      if (disabled) {
        return window.alert(
          `This bookmark is currently unavailable.\nMake sure that ${
            bookmarkItem[2]
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
 * Updates the `Launcher` with the bookmark.
 * @param launcher - The `Launcher` instance to update.
 * @param bookmarkItem - string[] that holds the bookmark to add.
 * @returns `void`
 */
export function updateLauncher(
  launcher: ILauncher,
  bookmarkItem: string[]
): void {
  const commandId: string = bookmarkItem[0];
  const disabled = bookmarkItem[4] === 'True';
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
export function updateMenu(bookmarkItem: string[]): void {
  const commandId: string = bookmarkItem[0];
  //const disabled = bookmarkItem[4] === 'True';
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
  const updatedBookmarks: Array<Array<string>> = new Array<Array<string>>();
  bookmarks.forEach(bookmarkItem => {
    if (bookmarkItem[0] !== bookmarkToDelete) {
      updatedBookmarks.push(bookmarkItem);
    }
  });
  bookmarks = updatedBookmarks;
  await settingsObject.set('bookmarks', bookmarks);
  console.log(`${bookmarkToDelete} has been deleted.`);
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
    body: JSON.stringify([currentDocName, currentDocPath, '', '', 'False'])
  });
  if (!bookmarkItemJSON.error) {
    const bookmarkItem = bookmarkItemJSON.bookmarkItem;
    addBookmark(commands, launcher, bookmarkItem);
  } else {
    window.alert(`Failed to save bookmark.\n${bookmarkItemJSON.reason}`);
  }
}

/**
 * Update the plugin's settings with the bookmark.
 * @async
 * @param bookmarkItem - `string[]` that stores the bookmark to be saved to the settings.
 * @returns `Promise<void>`
 */
export async function updateSettings(bookmarkItem: string[]): Promise<void> {
  bookmarks.push(bookmarkItem);
  await settingsObject.set('bookmarks', bookmarks);
}

/**
 * Synchronises a notebook that has been opened from a temporary location back to it's original instance when the file is saved.
 * Makes a HTTP call to the plugins server extension that does the actual copying.
 * @param bookmarkedNotebookModel - `DocumentRegistry.IContext<INotebookModel>` the context object for the current NotebookWdiget.
 */
export function syncBookmark(
  bookmarkedNotebookModel: DocumentRegistry.IContext<INotebookModel>
  //contentsModel: Contents.IModel
): void {
  for (let i = 0; i < bookmarks.length; i++) {
    if (
      bookmarks[i][3].startsWith('.tmp') &&
      bookmarks[i][3] === bookmarkedNotebookModel.path
    ) {
      requestAPI<any>('syncBookmark', {
        method: 'POST',
        body: JSON.stringify(bookmarks[i])
      })
        .then(result => {
          if (!result.success) {
            window.alert(
              `Failed to autosync for ${bookmarks[i]}.\n${result.reason}`
            );
          }
        })
        .catch(error => {
          window.alert(`Failed to autosync for ${bookmarks[i][0]}.\n${error}`);
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
  for (let i = 0; i < bookmarks.length; i++) {
    if (
      bookmarks[i][3].startsWith('.tmp') &&
      bookmarks[i][3] === notebookPanel.context.path
    ) {
      notebookPanel.context.fileChanged.connect(syncBookmark);
      break;
    }
  }
}
