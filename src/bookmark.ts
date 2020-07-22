export class Bookmark{
    private _title : string;
    public get title() : string {
        return this._title;
    }
    public set title(v : string) {
        this._title = v;
    }

    
    private _base_path : string;
    public get base_path() : string {
        return this._base_path;
    }
    public set base_path(v : string) {
        this._base_path = v;
    }
    
    
    private _abs_path : string;
    public get abs_path() : string {
        return this._abs_path;
    }
    public set abs_path(v : string) {
        this._abs_path = v;
    }
    
    
    private _active_path : string;
    public get active_path() : string {
        return this._active_path;
    }
    public set active_path(v : string) {
        this._active_path = v;
    }
    
    private _disabled : boolean;
    public get disabled() : boolean {
        return this._disabled;
    }

    public set disabled(v : boolean) {
        this._disabled = v;
    }
    
    
    private _category : string;
    public get category() : string {
        return this._category;
    }
    public set category(v : string) {
        this._category = v;
    }
    
    
 constructor(title:string, base_path: string, abs_path:string, active_path:string, disabled: boolean, category:string ){
        this._title = title;
        this._base_path = base_path
        this._abs_path = abs_path;
        this._active_path = active_path;
        this._disabled = disabled;
        this._category = category;
    }
}