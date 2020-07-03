import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './jupyterlab-favorites-extension';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import { ICommandPalette } from '@jupyterlab/apputils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { Menu } from '@lumino/widgets';

const TITLE = 'Favorites'
const FACTORY = 'Notebook';
/**
 * Initialization data for the jupyterlab-favorites-extension extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-favorites-extension',
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    settingsRegistry: ISettingRegistry,
    mainMenu: IMainMenu,
    commandPalette: ICommandPalette
  ) => {
    const { commands } = app;
    const commandPrefix = 'jupyterlab-favorites-extension:';
    const favoritesMainMenu = new Menu({ commands });
    favoritesMainMenu.title.label = TITLE;
    mainMenu.addMenu(favoritesMainMenu);
    const addFavoriteCommand = {
      id:commandPrefix+'addFavorite', 
      options:{
        label:'Add to favorites',
        caption:'Add to favorites',
        execute: (async: any) => {
          return commands.execute('docmanager:open', {
          path: '',
          factory: FACTORY
          });
        }
      }
    }
    commands.addCommand(addFavoriteCommand.id, addFavoriteCommand.options)
    app.contextMenu.addItem({
      command: addFavoriteCommand.id,
      selector: '.jp-Notebook'
    })
    
    console.log(
      'JupyterLab extension jupyterlab-favorites-extension is activated!'
    );

    requestAPI<any>('get_example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyterlab_favorites_extension server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default extension;
