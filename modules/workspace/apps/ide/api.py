import season
import json
import os
import zipfile
import tempfile
import time
import datetime
import shutil

def categories():
    try: category = wiz.server.wiz.config("wiz").get('category')
    except: category = wiz.server.config.wiz.category
    wiz.response.status(200, category)

def themes():
    res = wiz.src.theme.list()
    wiz.response.status(200, res)

def clean():
    wiz.server.config.reload()
    season.cache = season.stdClass()
    fs = season.util.os.FileSystem(os.path.join(season.path.project, 'cache'))
    fs.remove()
    wiz.response.status(200)

def list():
    mode = wiz.request.query("mode", 'app')
    if mode == 'app':
        res = wiz.src.app.list()
    elif mode == 'route':
        res = wiz.src.route.list()
    else:
        path = wiz.request.query("path", "")
        while len(path) > 0 and path[0] == "/":
            path = path[1:]
        if mode in ['controller', 'model']:
            mode = os.path.join('interfaces', mode)
        elif mode == 'store':
            mode = os.path.join('builtin_modules', 'WizStore')
        elif mode == 'router':
            mode = os.path.join('builtin_modules', 'WizRouter')

        basepath = os.path.join(season.path.project, "branch", wiz.branch(), mode)
        fs = season.util.os.FileSystem(basepath)
        res = fs.list(path)
        for i in range(len(res)):
            obj = dict()
            obj['name'] = res[i]
            obj['parent'] = path
            obj['path'] = os.path.join(path, res[i])
            obj['type'] = 'folder'
            filepath = fs.abspath(os.path.join(path, res[i]))
            if fs.isfile(os.path.join(path, res[i])):
                obj['type'] = 'file'
                obj['size'] = os.path.getsize(filepath)
            obj['ctime'] = os.path.getctime(filepath)
            res[i] = obj
    wiz.response.status(200, res)

def load():
    try:
        mode = wiz.request.query("mode", 'app')
        if mode == 'app':
            app_id = wiz.request.query("id", True)
            app = wiz.server.wiz.model("react/main")("apps").load(app_id)
            res = app.data()
        elif mode == 'route':
            app_id = wiz.request.query("id", True)
            app = wiz.src.route(app_id)
            res = app.data()
        else:
            path = wiz.request.query("path", True)
            while len(path) > 0 and path[0] == "/":
                path = path[1:]
            if mode in ['controller', 'model']:
                mode = os.path.join('interfaces', mode)
            elif mode == 'store':
                mode = os.path.join('builtin_modules', 'WizStore')
            elif mode == 'router':
                mode = os.path.join('builtin_modules', 'WizRouter')

            basepath = os.path.join(season.path.project, "branch", wiz.branch(), mode)
            fs = season.util.os.FileSystem(basepath)

            res = None
            extmap = wiz.server.config.wiz.file_support
            extmap['.jsx'] = "code/javascript"
            extmap['.tsx'] = "code/typescript"
            ext =  os.path.splitext(path)[1].lower()
            if ext in extmap:
                exttype = extmap[ext]
                if exttype == 'image':
                    res = {"type": "image", "data": path}
                if exttype.split("/")[0] == 'code':
                    codelang = exttype.split("/")[1]
                    res = {"type": "code", "lang": codelang, "data": fs.read(path)}
    except:
        res = None

    if res is None:
        wiz.response.status(404)

    wiz.response.status(200, res)

def app_create():
    app_id = wiz.request.query("app_id", True)
    if len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    data = wiz.request.query("data", True)
    data = json.loads(data)

    basepath = os.path.join(wiz.branchpath(), "apps")
    fs = season.util.os.FileSystem(basepath)
    if fs.exists(app_id):
        wiz.response.status(401, "ID already used")
    allowed = "qwertyuiopasdfghjklzxcvbnm.1234567890"
    for c in app_id:
        if c not in allowed:
            wiz.response.status(500, "only alphabet and number and . in package id")
    try:
        app = wiz.server.wiz.model("react/main")("apps").load(app_id)
        app.update(data)
        app.manager.clean()
    except Exception as e:
        wiz.response.status(400, str(e))
    wiz.response.status(200)

def app_rename():
    app_id = wiz.request.query("app_id", True)
    rename = wiz.request.query("rename", True)
    if len(rename) < 4 or len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    basepath = os.path.join(wiz.branchpath(), "apps")
    fs = season.util.os.FileSystem(basepath)
    if fs.exists(app_id) == False:
        wiz.response.status(404, "App Not Found")
    if fs.exists(rename):
        wiz.response.status(401, "Rename ID already used")
    
    allowed = "qwertyuiopasdfghjklzxcvbnm.1234567890"
    for c in rename:
        if c not in allowed:
            wiz.response.status(500, "only alphabet and number and . in package id")

    fs.rename(app_id, rename)
    wiz.response.status(200)

def app_update():
    app_id = wiz.request.query("app_id", True)
    if len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    data = wiz.request.query("data", True)
    data = json.loads(data)
    try:
        app = wiz.server.wiz.model("react/main")("apps").load(app_id)
        app.update(data)
        app.manager.clean()
    except Exception as e:
        wiz.response.status(400, str(e))
    wiz.response.status(200)

def app_delete():
    app_id = wiz.request.query("app_id", True)
    basepath = os.path.join(wiz.branchpath(), "apps")
    fs = season.util.os.FileSystem(basepath)
    if len(app_id) > 3 and fs.exists(app_id):
        fs.delete(app_id)
    wiz.response.status(200)

# route edit
def route_create():
    app_id = wiz.request.query("app_id", True)
    if len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    data = wiz.request.query("data", True)
    data = json.loads(data)

    basepath = os.path.join(wiz.branchpath(), "routes")
    fs = season.util.os.FileSystem(basepath)
    if fs.exists(app_id):
        wiz.response.status(401, "ID already used")
    allowed = "qwertyuiopasdfghjklzxcvbnm.1234567890"
    for c in app_id:
        if c not in allowed:
            wiz.response.status(500, "only alphabet and number and . in package id")
    app = wiz.src.route(app_id)
    try:
        app.update(data)
        app.manager.clean()
    except Exception as e:
        wiz.response.status(400, str(e))
    wiz.response.status(200)

def route_rename():
    app_id = wiz.request.query("app_id", True)
    rename = wiz.request.query("rename", True)
    if len(rename) < 4 or len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    basepath = os.path.join(wiz.branchpath(), "routes")
    fs = season.util.os.FileSystem(basepath)
    if fs.exists(app_id) == False:
        wiz.response.status(404, "App Not Found")
    if fs.exists(rename):
        wiz.response.status(401, "Rename ID already used")
    
    allowed = "qwertyuiopasdfghjklzxcvbnm.1234567890"
    for c in rename:
        if c not in allowed:
            wiz.response.status(500, "only alphabet and number and . in package id")

    fs.rename(app_id, rename)
    wiz.response.status(200)

def route_update():
    app_id = wiz.request.query("app_id", True)
    if len(app_id) < 4:
        wiz.response.status(404, "APP ID must be at least 4 characters ")

    data = wiz.request.query("data", True)
    data = json.loads(data)
    app = wiz.src.route(app_id)
    try:
        app.update(data)
        app.manager.clean()
    except Exception as e:
        wiz.response.status(400, str(e))
    wiz.response.status(200)

def route_delete():
    app_id = wiz.request.query("app_id", True)
    basepath = os.path.join(wiz.branchpath(), "routes")
    fs = season.util.os.FileSystem(basepath)
    if len(app_id) > 3 and fs.exists(app_id):
        fs.delete(app_id)
    wiz.response.status(200)

def file_create():
    mode = wiz.request.query("mode", True)
    path = wiz.request.query("path", True)
    name = wiz.request.query("name", True)
    ftype = wiz.request.query("type", True)
    data = wiz.request.query("data", "")

    if len(name) == 0:
        wiz.response.status(404, 'input file name')
    
    while len(path) > 0 and path[0] == "/":
        path = path[1:]
    if mode in ['controller', 'model']:
        mode = os.path.join('interfaces', mode)
    elif mode == 'store':
        mode = os.path.join('builtin_modules', 'WizStore')
    elif mode == 'router':
        mode = os.path.join('builtin_modules', 'WizRouter')

    basepath = os.path.join(wiz.branchpath(), mode, path)
    fs = season.util.os.FileSystem(basepath)

    if fs.exists(name):
        wiz.response.status(404, 'Already exists filename')

    if ftype == 'folder':
        fs.makedirs(name)
    else:
        fs.write(name, data)

    wiz.response.status(200)

def file_update():
    mode = wiz.request.query("mode", True)
    path = wiz.request.query("path", True)
    name = wiz.request.query("name", True)
    ftype = wiz.request.query("type", True)
    data = wiz.request.query("data", "")

    while len(path) > 0 and path[0] == "/":
        path = path[1:]
    if mode in ['controller', 'model']:
        mode = os.path.join('interfaces', mode)
    elif mode == 'store':
        mode = os.path.join('builtin_modules', 'WizStore')
    elif mode == 'router':
        mode = os.path.join('builtin_modules', 'WizRouter')

    basepath = os.path.join(season.path.project, "branch", wiz.branch(), mode)

    basename = os.path.basename(path)
    dirname = os.path.dirname(path)

    basepath = os.path.join(wiz.branchpath(), mode, dirname)
    fs = season.util.os.FileSystem(basepath)

    if basename != name:
        if fs.exists(basename):
            fs.rename(basename, name)
        else:
            wiz.response.status(404)

    if ftype == 'code':
        fs.write(name, data)
    
    if len(dirname) > 0:
        wiz.response.status(200, f"{dirname}/{name}")
    wiz.response.status(200, f"{name}")

def file_delete():
    mode = wiz.request.query("mode", True)
    if mode in ['controller', 'model']:
        mode = os.path.join('interfaces', mode)
    elif mode == 'store':
        mode = os.path.join('builtin_modules', 'WizStore')
    elif mode == 'router':
        mode = os.path.join('builtin_modules', 'WizRouter')

    basepath = os.path.join(season.path.project, "branch", wiz.branch(), mode)
    fs = season.util.os.FileSystem(basepath)
    path = wiz.request.query("path", True)
    while len(path) > 0 and path[0] == "/":
        path = path[1:]
    if len(path) > 0:
        if fs.exists(path):
            fs.remove(path)
    wiz.response.status(200)

def download():
    mode = wiz.request.query("mode", True)
    if mode in ['controller', 'model']:
        mode = os.path.join('interfaces', mode)
    elif mode == 'store':
        mode = os.path.join('builtin_modules', 'WizStore')
    elif mode == 'router':
        mode = os.path.join('builtin_modules', 'WizRouter')

    basepath = os.path.join(season.path.project, "branch", wiz.branch(), mode)
    fs = season.util.os.FileSystem(basepath)

    path = wiz.request.query("path", True)
    while len(path) > 0 and path[0] == "/":
        path = path[1:]
    
    if fs.isdir(path):
        path = fs.abspath(path)
        filename = os.path.splitext(os.path.basename(path))[0] + ".zip"
        zippath = os.path.join(tempfile.gettempdir(), 'dizest', datetime.datetime.now().strftime("%Y%m%d"), str(int(time.time())), filename)
        if len(zippath) < 10: return
        try:
            shutil.remove(zippath)
        except:
            pass
        os.makedirs(os.path.dirname(zippath))
        zipdata = zipfile.ZipFile(zippath, 'w')
        for folder, subfolders, files in os.walk(path):
            for file in files:
                zipdata.write(os.path.join(folder, file), os.path.relpath(os.path.join(folder,file), path), compress_type=zipfile.ZIP_DEFLATED)
        zipdata.close()
        wiz.response.download(zippath, as_attachment=True, filename=filename)
    else:
        path = fs.abspath(path)
        wiz.response.download(path, as_attachment=True)

    wiz.response.abort(404)

import git

def git_changes():
    branchfs = wiz.branchfs()
    repo = git.Repo.init(branchfs.abspath())
    
    repo.git.add('--all')
    src = "index"
    parent = repo.commit()
    diffs = parent.diff(None)
    
    res = dict()
    for diff in diffs:
        obj = {"change_type": diff.change_type, "path": diff.b_path, "commit": src, "parent": str(parent)}        
        path = obj['path']
        mode = path.split("/")[0]
        if mode == 'interfaces':
            mode = path.split("/")[1]
        if mode not in res: res[mode] = []

        if mode == 'routes': obj['path'] = path[7:]
        if mode == 'apps': obj['path'] = path[5:]
        if mode == 'controller': obj['path'] = path[22:]
        if mode == 'model': obj['path'] = path[17:]
        if mode == 'themes': obj['path'] = path[7:]
        if mode == 'resources': obj['path'] = path[10:]
        if mode == 'config': obj['path'] = path[7:]

        obj['mode'] = mode
        res[mode].append(obj)

    wiz.response.status(200, res)

def git_commit():
    try:
        branchfs = wiz.branchfs()
        repo = git.Repo.init(branchfs.abspath())
        message = wiz.request.query("message", "commit")
        repo.index.commit(message)
        origin = repo.remote(name='wiz')
        origin.push(wiz.branch())
    except Exception as e:
        wiz.response.status(500, str(e))
    wiz.response.status(200)

def package():
    yarn = wiz.server.wiz.model("react/yarn")()

    _info = yarn.info()
    except_target = yarn.default_dep + yarn.default_devdep
    dependencies = {}
    for pkg in _info["dependencies"]:
        if pkg not in except_target:
            dependencies[pkg] = _info["dependencies"][pkg]
    devDependencies = {}
    for pkg in _info["devDependencies"]:
        if pkg not in except_target:
            devDependencies[pkg] = _info["devDependencies"][pkg]
    wiz.response.status(200, {
        "dependencies": dependencies,
        "devDependencies": devDependencies,
    })

def package_add():
    package_name = wiz.request.query("name", True)
    isdev = wiz.request.query("isdev", True)
    yarn = wiz.server.wiz.model("react/yarn")()
    targets = [package_name]
    mode = "dev" if isdev == 'true' else "normal"
    yarn.add(*targets, mode=mode)
    wiz.response.status(200)

def package_remove():
    package_name = wiz.request.query("name", True)
    isdev = wiz.request.query("isdev", True)
    yarn = wiz.server.wiz.model("react/yarn")()
    except_target = yarn.default_dep + yarn.default_devdep
    if package_name in except_target:
        wiz.response.status(500)

    mode = "dev" if isdev == 'true' else "normal"
    yarn.remove(package_name, mode=mode)
    wiz.response.status(200)
