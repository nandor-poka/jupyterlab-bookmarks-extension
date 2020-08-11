/** Main entrypoint for Jupyterlab Bookmarks plugin.
 * Copyright (c) 2020, Dr. Nandor Poka, All rights reserved.
 */

// JupyterLab / Lumino imports
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './jupyterlab-bookmarks-extension';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';

// Custom imports
import { initBookmarksMainMenu, getBookmarksMainMenu } from './menus';
import {
  addBookmarkContextMenuCommand,
  addBookmarkLauncherCommand,
  removeBookmarkCommand,
  addCategoryCommand,
  deleteCategoryCommand,
  importBookmarksCommand
} from './commands';
import {
  initConstantsModule,
  TITLE_MANAGEMENT,
  UNCATEGORIZED,
  setSettingsObject,
  getBookmarks,
  setBookmarks,
  getSettingsObject
} from './constants';

import {
  addBookmark,
  addAutoSyncToBookmark,
  loadSetting,
  updateSettings,
  addCategory,
  compareBookmarkMaps
} from './functions';

import { Bookmark } from './bookmark';

const PLUGIN_ID = 'jupyterlab-bookmarks-extension:bookmarks';

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
    dockManager: IDocumentManager
  ) => {
    // Extension level constants / variables
    const { commands } = app;

    mainMenu.addMenu(initBookmarksMainMenu(commands));

    initConstantsModule(notebookTracker, dockManager, commands, launcher);

    getBookmarksMainMenu().addItem({
      type: 'command',
      command: addBookmarkLauncherCommand.id
    });
    getBookmarksMainMenu().addItem({
      type: 'command',
      command: removeBookmarkCommand.id
    });
    getBookmarksMainMenu().addItem({
      type: 'separator'
    });

    // Code for startup
    // Wait for the application to be restored and
    // for the settings for this plugin to be loaded
    Promise.all([app.restored, settingsRegistry.load(PLUGIN_ID)]).then(
      ([, settings]) => {
        requestAPI<any>('settings')
          .then(async response => {
            const persistentSettings = JSON.parse(response.settings);
            if (
              response.result === true &&
              !compareBookmarkMaps(
                new Map(persistentSettings.bookmarks),
                new Map(settings.get('bookmarks').composite as Array<
                  [string, Bookmark]
                >)
              )
            ) {
              await settings.set('bookmarks', persistentSettings.bookmarks);
            }
          })
          .then(() => {
            // Read the settings
            setSettingsObject(settings);
            loadSetting(getSettingsObject());
            // Listen for your plugin setting changes using Signal
            //settingsObject.changed.connect(loadSetting);

            requestAPI<any>('updateBookmarks', {
              method: 'POST',
              body: JSON.stringify({
                bookmarksData: Array.from(getBookmarks().entries())
              })
            })
              .then(data => {
                setBookmarks(new Map(data.bookmarks));
                getBookmarks().forEach(bookmarkItem => {
                  addBookmark(commands, launcher, bookmarkItem, true, true);
                });
                updateSettings();
              })
              .catch(reason => {
                window.alert(
                  `Failed to load bookmarks from server side during startup.\n${reason}`
                );
              });
            notebookTracker.currentChanged.connect(addAutoSyncToBookmark);
          })
          .catch(reason => {
            window.alert(
              `Failed to read JupyterLab bookmarks' settings from file.\n${reason}`
            );
          });
      }
    );

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

    commands.addCommand(addCategoryCommand.id, addCategoryCommand.options);

    commands.addCommand(
      deleteCategoryCommand.id,
      deleteCategoryCommand.options
    );

    commands.addCommand(
      importBookmarksCommand.id,
      importBookmarksCommand.options
    );

    app.contextMenu.addItem({
      command: addBookmarkContextMenuCommand.id,
      selector: '.jp-Notebook',
      rank: 10
    });

    launcher.add({
      command: addBookmarkLauncherCommand.id,
      category: TITLE_MANAGEMENT,
      rank: 1
    });

    launcher.add({
      command: removeBookmarkCommand.id,
      category: TITLE_MANAGEMENT,
      rank: 2,
      args: { category: 'all' }
    });

    launcher.add({
      command: addCategoryCommand.id,
      category: TITLE_MANAGEMENT,
      rank: 3
    });

    launcher.add({
      command: deleteCategoryCommand.id,
      category: TITLE_MANAGEMENT,
      rank: 4
    });

    launcher.add({
      command: importBookmarksCommand.id,
      category: TITLE_MANAGEMENT,
      rank: 5
    });

    addCategory(UNCATEGORIZED, true);

    console.log(
      'JupyterLab extension jupyterlab-bookmarks-extension is activated!'
    );
  }
};

export default extension;
