/** Utilities for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// Jupyterlab / Lumino imports
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { InputDialog, showErrorMessage } from '@jupyterlab/apputils';
import { notebookIcon } from '@jupyterlab/ui-components';
import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { requestAPI } from './jupyterlab-bookmarks-extension';
import { CommandRegistry } from '@lumino/commands';
import { IDisposable } from '@lumino/disposable';

//custom imports
import { getBookmarksMainMenu } from './menus';
import { addBookmarkLauncherCommand, removeBookmarkCommand } from './commands';
import {
  commandPrefix,
  bookmarkCommands,
  NOTEBOOK_FACTORY,
  DISABLED_TITLE,
  TITLE,
  bookmarkLaunchers,
  bookmarkMenuItems,
  categories,
  UNCATEGORIZED,
  setBookmarks,
  getBookmarks,
  getSettingsObject,
  getLauncher
} from './constants';
import { Bookmark } from './bookmark';
import { ILauncher } from '@jupyterlab/launcher';

/**
 * Load the settings for this extension. Sets the `bookmarks` to the bookmarks stored in the settings.
 *
 * @param settings `ISettingsRegistry.Isettings` - Extension settings
 */
export function loadSetting(settings: ISettingRegistry.ISettings): void {
  // Read the settings and convert to the correct type
  setBookmarks(
    new Map(settings.get('bookmarks').composite as Array<[string, Bookmark]>)
  );
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
    getBookmarks().set(bookmarkItem.title, bookmarkItem);
  }
  await getSettingsObject().set(
    'bookmarks',
    JSON.parse(JSON.stringify(Array.from(getBookmarks().entries())))
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
    category: disabled ? DISABLED_TITLE : TITLE + bookmarkItem.category
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
  getBookmarks().delete(bookmarkToDelete);
  await getSettingsObject().set(
    'bookmarks',
    JSON.parse(JSON.stringify(Array.from(getBookmarks().entries())))
  );
}

/**
 * Adds `category` to the `Launcher`, by initializing the
 * new category with two standard commands. Used internally by
 * `addCategory()`.
 * @param category `string` - the name of the category to add.
 */
function addCategoryToLauncher(category: string): void {
  categories.get(category).push(
    getLauncher().add({
      command: addBookmarkLauncherCommand.id,
      category: TITLE + category,
      rank: 1,
      args: { category }
    })
  );
  categories.get(category).push(
    getLauncher().add({
      command: removeBookmarkCommand.id,
      category: TITLE + category,
      rank: 2,
      args: { category }
    })
  );
}

/**
 * Adds new category. Duplicates cannot be added.
 * @param categoryToAdd `string` - the name of the category to add.
 * @param silent `boolean` - `true` if suppress warning for duplicate category.
 *
 */
export function addCategory(categoryToAdd: string, silent?: boolean): void {
  if (!categories.has(categoryToAdd)) {
    categories.set(categoryToAdd, new Array<IDisposable>());
    addCategoryToLauncher(categoryToAdd);
  } else {
    if (!silent) {
      showErrorMessage(
        'Duplicate category',
        `Category "${categoryToAdd}" already exists. Not adding.`
      );
    }
  }
}

/**
 * Deletes a category. Disposes launcher items in the category and moves bookmarks from
 * the category being deleted to Uncategorized`.
 * @param categoryToDelete `string` - the name of the category to delete.
 */
export function deleteCategory(categoryToDelete: string): void {
  getBookmarks().forEach(bookmark => {
    if (bookmark.category === categoryToDelete) {
      bookmarkLaunchers.get(bookmark.title).dispose();
      bookmark.category = UNCATEGORIZED;
      updateLauncher(getLauncher(), bookmark);
      updateSettings(bookmark);
    }
  });
  categories.get(categoryToDelete).forEach(item => {
    item.dispose();
  });
  categories.delete(categoryToDelete);
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
  if (bookmarkItem.category === '') {
    bookmarkItem.category = UNCATEGORIZED;
  }
  addCategory(bookmarkItem.category, true);
  if (!skipDuplicateCheck) {
    const bookmarkName = bookmarkItem.title;
    //const bookmarkAbsPath = bookmarkItem[2];
    if (getBookmarks().has(bookmarkName)) {
      // if we have a bookmark with the same title we have to check for paths to see if they are the same or not.
      if (bookmarkItem.absPath === getBookmarks().get(bookmarkName).absPath) {
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
            getBookmarks().forEach(bookmark => {
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
 * @param category - `string` the name of the category to add the bookmark to. Empty string if no category (`''`).
 * @returns `Promise<void>`
 */
export async function addBookmarkItem(
  commands: CommandRegistry,
  launcher: ILauncher,
  currentDocName: string,
  currentDocPath: string,
  category: string
): Promise<void> {
  const bookmarkItemJSON = await requestAPI<any>('getAbsPath', {
    method: 'POST',
    body: JSON.stringify(
      new Bookmark(currentDocName, currentDocPath, '', '', false, category)
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
  let iterartorBookmark: Bookmark;
  for (const bookmarkKey in getBookmarks().keys) {
    iterartorBookmark = getBookmarks().get(bookmarkKey);
    if (
      iterartorBookmark.activePath.startsWith('.tmp') &&
      iterartorBookmark.absPath === bookmarkedNotebookModel.path
    ) {
      //Once we find the bookmark that corresponds to the file that has been saved we make a request to the server to sync and exit the loop.
      requestAPI<any>('syncBookmark', {
        method: 'POST',
        body: JSON.stringify(iterartorBookmark)
      })
        .then(result => {
          if (!result.success) {
            window.alert(
              `Failed to autosync for ${iterartorBookmark.title}.\n${
                result.reason
              }`
            );
          }
        })
        .catch(error => {
          window.alert(
            `Failed to autosync for ${iterartorBookmark.title}.\n${error}`
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
  let iterartorBookmark: Bookmark;
  for (const bookmarkKey in getBookmarks().keys) {
    iterartorBookmark = getBookmarks().get(bookmarkKey);
    if (
      iterartorBookmark.activePath.startsWith('.tmp') &&
      iterartorBookmark.absPath === notebookPanel.context.path
    ) {
      // If we find the file that needs to be synced we connect the appropriate function and exit the loop
      notebookPanel.context.fileChanged.connect(syncBookmark);
      break;
    }
  }
}
