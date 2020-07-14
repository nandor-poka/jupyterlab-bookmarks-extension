import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './jupyterlab-bookmarks-extension';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import {
  ICommandPalette,
  InputDialog,
  showErrorMessage
} from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';
import { notebookIcon, closeIcon, addIcon } from '@jupyterlab/ui-components';
import { Menu } from '@lumino/widgets';
import { IDisposable } from '@lumino/disposable';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { Contents } from '@jupyterlab/services';
import { FileDialog } from '@jupyterlab/filebrowser';
import { IDocumentManager } from '@jupyterlab/docmanager';
const VERSION = '0.5.0';
const TITLE_PLAIN = 'Bookmarks';
const TITLE = `${TITLE_PLAIN} - ${VERSION}`;
const DISABLED_TITLE = `Disabled bookmarks - ${VERSION}`;
const NOTEBOOK_FACTORY = 'Notebook';
const PLUGIN_ID = 'jupyterlab-bookmarks-extension:bookmarks';

/**
 * Data structure is Array of arrays => [[name, path in current JL root, absolute_path, temp_path, disabled]]
 */
let bookmarks: Array<Array<string>> = new Array<Array<string>>();
let settingsObject: ISettingRegistry.ISettings = null;
const bookmarkCommands: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();
const bookmarkLaunchers: Map<string, IDisposable> = new Map<
  string,
  IDisposable
>();

const bookmarkMenuItems: Map<string, Menu.IItem> = new Map<
  string,
  Menu.IItem
>();
/**
 * Initialization data for the jupyterlab-bookmarks-extension extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [
    ILauncher,
    ISettingRegistry,
    IMainMenu,
    ICommandPalette,
    INotebookTracker,
    IDocumentManager
  ],
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    settingsRegistry: ISettingRegistry,
    mainMenu: IMainMenu,
    commandPalette: ICommandPalette,
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager
  ) => {
    // Extension level constants / variables
    const { commands } = app;
    const commandPrefix = 'jupyterlab-bookmarks-extension:';
    const bookmarksMainMenu = new Menu({ commands });
    bookmarksMainMenu.title.label = TITLE_PLAIN;
    mainMenu.addMenu(bookmarksMainMenu);

    const addBookmarkContextMenuCommand = {
      id: commandPrefix + 'addBookmark',
      options: {
        label: 'Add to bookmarks',
        caption: 'Add to bookmarks',
        execute: async (): Promise<any> => {
          const currentDoc = notebookTracker.currentWidget;
          console.log(currentDoc);
          currentDoc.context.fileChanged.connect(syncBookmark);
          const currentDocName = currentDoc.context.contentsModel.name;
          const currentDocPath = currentDoc.context.path;
          addBookmarkItem(currentDocName, currentDocPath);
        }
      }
    };

    const addBookmarkLauncherCommand = {
      id: commandPrefix + 'addBookmarkFromLauncher',
      options: {
        label: 'Add bookmark',
        caption: 'Add bookmark',
        icon: addIcon,
        execute: (): void => {
          FileDialog.getOpenFiles({
            manager: docManager,
            filter: model => model.type === 'notebook'
          }).then(result => {
            result.value.forEach(selectedFile => {
              addBookmarkItem(selectedFile.name, selectedFile.path);
            });
          });
        }
      }
    };

    const removeBookmarkCommand = {
      id: commandPrefix + 'removeBookmark',
      options: {
        label: 'Delete Bookmark',
        caption: 'Delete Bookmark',
        icon: closeIcon,
        execute: (): void => {
          InputDialog.getItem({
            title: 'Select bookmark to delete',
            items: Array.from(bookmarkLaunchers, item => {
              return item[0];
            })
          }).then(async result => {
            if (result.button.label !== 'Cancel') {
              const bookmarkToDelete: string = result.value;
              deleteBookmark(bookmarkToDelete);
            }
          });
        }
      }
    };

    bookmarksMainMenu.addItem({
      type: 'command',
      command: addBookmarkLauncherCommand.id
    });
    bookmarksMainMenu.addItem({
      type: 'command',
      command: removeBookmarkCommand.id
    });
    bookmarksMainMenu.addItem({
      type: 'separator'
    });
    // Code for startup
    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settingsRegistry.load(PLUGIN_ID)])
      .then(([, settings]) => {
        // Read the settings
        settingsObject = settings;
        loadSetting(settingsObject);

        // Listen for your plugin setting changes using Signal
        //settingsObject.changed.connect(loadSetting);

        requestAPI<any>('updateBookmarks', {
          method: 'POST',
          body: JSON.stringify({ bookmarksData: bookmarks })
        })
          .then(data => {
            bookmarks = data.bookmarks;
            bookmarks.forEach(bookmarkItem => {
              addBookmark(bookmarkItem, true);
            });
          })
          .catch(reason => {
            window.alert(
              `Failed to load bookmarks from server side during startup.\n${reason}`
            );

            console.error(
              `Failed to load bookmarks from server side during startup.\n${reason}`
            );
          });
        notebookTracker.currentChanged.connect(addAutoSyncToBookmark);
      })
      .catch(reason => {
        window.alert(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
        console.error(
          `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
        );
      });

    // Add command to context menu, when clicked on an open notebook.
    commands.addCommand(
      addBookmarkContextMenuCommand.id,
      addBookmarkContextMenuCommand.options
    );
    commands.addCommand(
      removeBookmarkCommand.id,
      removeBookmarkCommand.options
    );
    commands.addCommand(
      addBookmarkLauncherCommand.id,
      addBookmarkLauncherCommand.options
    );
    app.contextMenu.addItem({
      command: addBookmarkContextMenuCommand.id,
      selector: '.jp-Notebook',
      rank: 10
    });

    launcher.add({
      command: removeBookmarkCommand.id,
      category: TITLE,
      rank: 2
    });
    launcher.add({
      command: addBookmarkLauncherCommand.id,
      category: TITLE,
      rank: 1
    });
    console.log(
      'JupyterLab extension jupyterlab-bookmarks-extension is activated!'
    );

    // Utilities
    /**
     * Load the settings for this extension
     *
     * @param settings Extension settings
     */
    function loadSetting(settings: ISettingRegistry.ISettings): void {
      // Read the settings and convert to the correct type
      bookmarks = settings.get('bookmarks').composite as Array<Array<string>>;
    }

    /** Adds a `bookmarkItem`, to the `commands` list, to the Launcher and to the Bookmarks menu.
     * @async
     * @param bookmarkItem - `string[]`. The bookmarkItem to be added.
     * @param skipDuplicateCheck - `boolean`. Optional parameter to skip or not to skip
     * duplicate check.
     * @returns `Promise<boolean>`
     */
    async function addBookmark(
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
                  updateCommands(bookmarkItem);
                  updateLauncher(bookmarkItem);
                  updateMenu(bookmarkItem);
                  updateSettings(bookmarkItem);
                  console.log(
                    commandPrefix + bookmarkItem[0] + ' was overwritten'
                  );
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
                  updateCommands(bookmarkItem);
                  updateLauncher(bookmarkItem);
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
      updateCommands(bookmarkItem);
      updateLauncher(bookmarkItem);
      updateMenu(bookmarkItem);
      updateSettings(bookmarkItem);
      console.log(commandPrefix + bookmarkItem[0] + ' added to Launcher');
      return true;
    }

    function updateCommands(bookmarkItem: string[]): void {
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

    function updateLauncher(bookmarkItem: string[]): void {
      const commandId: string = bookmarkItem[0];
      const disabled = bookmarkItem[4] === 'True';
      const launcherItem: IDisposable = launcher.add({
        command: commandPrefix + commandId,
        category: disabled ? DISABLED_TITLE : TITLE
      });
      bookmarkLaunchers.set(commandId, launcherItem);
    }

    function updateMenu(bookmarkItem: string[]) {
      const commandId: string = bookmarkItem[0];
      //const disabled = bookmarkItem[4] === 'True';
      const bookmarkMenuItem = bookmarksMainMenu.addItem({
        type: 'command',
        command: commandPrefix + commandId
      });
      bookmarkMenuItems.set(commandId, bookmarkMenuItem);
    }

    async function deleteBookmark(bookmarkToDelete: string): void {
      bookmarkLaunchers.get(bookmarkToDelete).dispose();
      bookmarkLaunchers.delete(bookmarkToDelete);
      bookmarkCommands.get(bookmarkToDelete).dispose();
      bookmarkCommands.delete(bookmarkToDelete);
      bookmarksMainMenu.removeItem(bookmarkMenuItems.get(bookmarkToDelete));
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

    async function addBookmarkItem(
      currentDocName: string,
      currentDocPath: string
    ): Promise<void> {
      const bookmarkItemJSON = await requestAPI<any>('getAbsPath', {
        method: 'POST',
        body: JSON.stringify([currentDocName, currentDocPath, '', '', 'False'])
      });
      if (!bookmarkItemJSON.error) {
        const bookmarkItem = bookmarkItemJSON.bookmarkItem;
        addBookmark(bookmarkItem);
      } else {
        window.alert(`Failed to save bookmark.\n${bookmarkItemJSON.reason}`);
      }
    }

    async function updateSettings(bookmarkItem: string[]): Promise<void> {
      bookmarks.push(bookmarkItem);
      await settingsObject.set('bookmarks', bookmarks);
    }
    function syncBookmark(
      bookmarkedNotebookModel: DocumentRegistry.IContext<INotebookModel>,
      contentsModel: Contents.IModel
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
                  `Failed to set up autosync for ${bookmarks[i]}.\n${
                    result.reason
                  }`
                );
              }
            })
            .catch(error => {
              window.alert(
                `Failed to set up autosync for ${bookmarks[i][0]}.\n${error}`
              );
            });
          break;
        }
      }
    }

    function addAutoSyncToBookmark(
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
  }
};

export default extension;
