import json

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
import tornado
  
class StartupHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(
            json.dumps({})
        )

class AddFavortiteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post, 
    # patch, put, delete, options) to ensure only authorized user can request the 
    # Jupyter server
    @tornado.web.authenticated
    def post(self):
        self.finish(json.dumps({}))

class GetFavoritesHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(
            json.dumps({})
        )

def setup_handlers(web_app):
    host_pattern = ".*$"
    
    base_url = web_app.settings["base_url"]
    startup_pattern = url_path_join(base_url, "jupyterlab-favorites-extension", "startup")
    add_favorite_pattern = url_path_join(base_url, "jupyterlab-favorites-extension", "addFavorite")
    get_favorites_pattern =  url_path_join(base_url, "jupyterlab-favorites-extension", "getFavorites")
    handlers = [
        (startup_pattern, StartupHandler),
        (add_favorite_pattern, AddFavortiteHandler),
        (get_favorites_pattern, GetFavoritesHandler)
        ]
    web_app.add_handlers(host_pattern, handlers)
