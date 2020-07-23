export class Bookmark{
    public title : string;
    public base_path : string;
    public abs_path : string;
    public active_path : string;
    public disabled : boolean;
    public category : string;    
    
 constructor(title:string, base_path: string, abs_path:string, active_path:string, disabled: boolean, category:string ){
        this.title = title;
        this.base_path = base_path
        this.abs_path = abs_path;
        this.active_path = active_path;
        this.disabled = disabled;
        this.category = category;
    }
}