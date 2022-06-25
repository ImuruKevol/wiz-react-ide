let wiz_controller = async ($sce, $scope, $timeout) => {
    let _$timeout = $timeout;
    $timeout = (timestamp) => new Promise((resolve) => _$timeout(resolve, timestamp));

    let platform = navigator?.userAgentData?.platform || navigator?.platform || 'unknown'
    $scope.ismac = platform.toUpperCase().indexOf('MAC') >= 0;

    let alert = async (message) => {
        await wiz.connect("modal.message")
            .data({
                title: "Alert",
                message: message,
                btn_action: "Close",
                btn_class: "btn-primary"
            })
            .event("modal-show");
    }

    let monaco_option = (language, tab) => {
        let opt = {
            value: '',
            language: language,
            theme: "vs",
            fontSize: 14,
            automaticLayout: true,
            minimap: {
                enabled: false
            }
        };

        opt.onLoad = async (editor) => {
            tab.editor = editor;
            let shortcuts = $scope.shortcut.configuration(window.monaco);
            for (let shortcutname in shortcuts) {
                let monacokey = shortcuts[shortcutname].monaco;
                let fn = shortcuts[shortcutname].fn;
                if (!monacokey) continue;

                editor.addCommand(monacokey, async () => {
                    await fn();
                });
            }
        }

        return opt;
    }

    $scope.trustAsHtml = $sce.trustAsHtml;
    $scope.display = {};
    $scope.display.date = function (date) {
        let targetdate = moment(date);
        let diff = new Date().getTime() - new Date(targetdate).getTime();
        diff = diff / 1000 / 60 / 60;
        if (diff > 24) return targetdate.format("YYYY-MM-DD hh:mm");
        if (diff > 1) return Math.floor(diff) + " hours ago"
        diff = diff * 60;
        if (diff < 2) return "just now";
        return Math.floor(diff) + " minutes ago";
    }
    $scope.display.filesize = (value) => {
        if (!value) return "--";
        let kb = value / 1024;
        if (kb < 1) return value + "B";
        let mb = kb / 1024;
        if (mb < 1) return Math.round(kb * 100) / 100 + "KB";
        let gb = mb / 1024;
        if (gb < 1) return Math.round(mb * 100) / 100 + "MB";
        return Math.round(gb * 100) / 100 + "GB";
    }
    $scope.display.timer = (value) => {
        return moment(new Date(value * 1000)).format("YYYY-MM-DD HH:mm:ss");
    }

    // data binding
    $scope.data = {};
    try {
        $scope.data.hash_id = location.hash.split("#")[1];
    } catch (e) {
        $scope.data.hash_id = '';
    }
    if (!$scope.data.hash_id) $scope.data.hash_id = 'app/new';

    let loader = {};
    // loader.controller = async () => {
    //     let res = await wiz.API.async("controllers");
    //     if (res.code == 200) return res.data;
    //     return [];
    // };
    loader.theme = async () => {
        let res = await wiz.API.async("themes");
        if (res.code == 200) return res.data;
        return [];
    };
    loader.category = async () => {
        let res = await wiz.API.async("categories");
        if (res.code == 200) return res.data;
        return [];
    };

    loader.init = async () => {
        $scope.data.theme = await loader.theme();
        // $scope.data.controller = await loader.controller();
        $scope.data.category = await loader.category();
    }

    await loader.init();
    $scope.data.lang = {
        html: ['pug', 'html'],
    };
    $scope.data.sortable = { handle: '.draggable' };
    $scope.data.search = {};
    $scope.data.apps = {};
    $scope.data.files = {};
    $scope.data.files.router = {};
    $scope.data.files.controller = {};
    $scope.data.files.store = {};
    $scope.data.files.modules = {};
    $scope.data.files.model = {};
    $scope.data.files.themes = {};
    $scope.data.files.resources = {};
    $scope.data.files.config = {};

    // cache binding
    $scope.cache = {};
    $scope.cache.apps = {};
    $scope.cache.apps_dic = {};
    $scope.cache.routes = {};
    $scope.cache.routes_dic = {};

    // event binding
    $scope.event = {};

    $scope.event.get = {};
    $scope.event.get.app = async (app_id, refresh) => {
        if (app_id != 'new') {
            if (!refresh && $scope.cache.apps[app_id]) return $scope.cache.apps[app_id];
            let res = await wiz.API.async("load", { mode: 'app', id: app_id });
            if (res.code == 200) {
                $scope.cache.apps[app_id] = res.data;
                return $scope.cache.apps[app_id];
            }
        }
        let data = {
            package: {
                id: '',
                category: $scope.data.category[0].id,
                script_type: 'text/javascript',
                theme: '',
                controller: '',
                properties: {
                    html: 'pug',
                    // js: 'javascript',
                }
            },
            api: '',
            socketio: '',
            dic: {},
            view: '',
            scss: '',
            jsx: ''
        }
        return data;
    }
    $scope.event.get.route = async (app_id, refresh) => {
        if (app_id != 'new') {
            if (!refresh && $scope.cache.routes[app_id]) return $scope.cache.routes[app_id];
            let res = await wiz.API.async("load", { mode: 'route', id: app_id });
            if (res.code == 200) {
                $scope.cache.routes[app_id] = res.data;
                return $scope.cache.routes[app_id];
            }
        }
        let data = {
            package: {
                id: '',
                title: '',
                route: '',
                controller: ''
            },
            controller: '',
            dic: {}
        }
        return data;
    }
    $scope.event.get.files = async (mode, item) => {
        let res = await wiz.API.async("load", { mode: mode, path: item.path });
        if (res.code == 200) return res.data;
        return null;
    }

    // load list
    $scope.event.load = async (mode) => {
        if (!mode) mode = $scope.viewer.list.mode;
        if (mode == 'app') {
            let res = await wiz.API.async("list", { mode: mode });
            let data = res.data;
            data.sort((a, b) => {
                return a.package.id.localeCompare(b.package.id);
            });
            $scope.data.apps = {};
            for (let i = 0; i < data.length; i++) {
                let category = data[i].package.category;
                if (!$scope.data.apps[category]) $scope.data.apps[category] = [];
                $scope.data.apps[category].push(data[i]);
            }
        } else if (mode == 'route') {
            let res = await wiz.API.async("list", { mode: mode });
            let data = res.data;
            data.sort((a, b) => {
                return a.package.id.localeCompare(b.package.id);
            });
            $scope.data.routes = [];
            for (let i = 0; i < data.length; i++) {
                $scope.data.routes.push(data[i]);
            }
        } else if ($scope.data.files[mode]) {
            let targetobj = $scope.data.files[mode];
            if (!targetobj.path) targetobj.path = "";
            let res = await wiz.API.async("list", { mode: mode, path: targetobj.path });
            let data = res.data;
            data.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
            data.sort((a, b) => {
                return b.type.localeCompare(a.type);
            });
            $scope.data.files[mode].list = data;
        }

        $scope.viewer.list.view = 'list';
        $scope.viewer.list.mode = mode;
        await $timeout();
    }

    // delete
    $scope.event.delete = async () => {
        let mode = $scope.viewer.tabs.active_tab.mode;
        let data = angular.copy($scope.viewer.tabs.active_tab.data);

        let message = "Are you sure delete?"
        if (mode == 'app') {
            message = "Are you sure delete `" + data.package.title + "` app?";
        } else if (mode == 'route') {
            message = "Are you sure delete `" + data.package.title + "` router?";
        }

        let res = await wiz.connect("modal.message")
            .data({
                title: "Delete",
                message: message,
                btn_close: 'Close',
                btn_action: "Delete",
                btn_class: "btn-danger"
            })
            .event("modal-show");
        if (!res) return;

        let removes = [];
        if (mode == 'app') {
            res = await wiz.API.async("app_delete", { app_id: data.package.id });
            for (let i = 0; i < $scope.viewer.tabs.data.length; i++) {
                if ($scope.viewer.tabs.data[i].mode != 'app') continue;
                if ($scope.viewer.tabs.data[i].org_app_id == data.package.id) {
                    removes.push($scope.viewer.tabs.data[i]);
                }
            }
        } else if (mode == 'route') {
            res = await wiz.API.async("route_delete", { app_id: data.package.id });
            for (let i = 0; i < $scope.viewer.tabs.data.length; i++) {
                if ($scope.viewer.tabs.data[i].mode != 'route') continue;
                if ($scope.viewer.tabs.data[i].org_app_id == data.package.id) {
                    removes.push($scope.viewer.tabs.data[i]);
                }
            }
        } else {
            res = await wiz.API.async("file_delete", { mode: mode, path: data.path });
            for (let i = 0; i < $scope.viewer.tabs.data.length; i++) {
                if ($scope.viewer.tabs.data[i].mode != mode) continue;
                if ($scope.viewer.tabs.data[i].path == data.path) {
                    removes.push($scope.viewer.tabs.data[i]);
                }
            }
        }

        // remove deleted tabs
        for (let i = 0; i < removes.length; i++) {
            $scope.viewer.tabs.remove(removes[i]);
        }

        // activate remained tab
        if ($scope.viewer.tabs.data.length > 0) {
            await $scope.viewer.tabs.data[0].activate();
        } else {
            $scope.viewer.tabs.active_tab = null;
        }

        // reload list
        await $scope.event.load(mode);

        await $timeout();
    }

    // save
    $scope.event.clean = async () => {
        await wiz.API.async("clean");
        toastr.success("cache deleted")
    }

    $scope.event.save = async () => {
        let mode = $scope.viewer.tabs.active_tab.mode;
        let data = angular.copy($scope.viewer.tabs.active_tab.data);

        if (mode == 'app') {
            const { title } = data.package;
            if (!/^[A-Z]{1}[A-Za-z]+$/.test(title)) {
                return alert("Component Name is start with Large Alphabet and only alphabet");
            }
            let is_new = $scope.viewer.tabs.active_tab.new;
            let org_app_id = $scope.viewer.tabs.active_tab.org_app_id;

            // set dic
            let dic = $scope.viewer.tabs.active_tab.dic;
            let dicv = {};
            let dickey = 'default';
            try {
                for (let key in dic.data) {
                    dickey = key;
                    if (dic.data[key].length == 0 && key != 'default') {
                        delete dic.data[key];
                        dic.list.remove(key);
                        $scope.viewer.tabs.active_tab.data.dic_selected = 'default';
                    } else {
                        dicv[key] = JSON.parse(dic.data[key]);
                    }
                }
            } catch (e) {
                return alert('Dictionary value must be JSON format (' + dickey + ')');
            }
            data.dic = $scope.viewer.tabs.active_tab.data.dic = dicv;

            // update
            if (is_new) {
                let res = await wiz.API.async("app_create", { app_id: data.package.id, data: JSON.stringify(data) });
                if (res.code != 200)
                    return alert(res.data);
                $scope.viewer.tabs.active_tab.org_app_id = data.package.id;
                $scope.viewer.tabs.active_tab.app_id = data.package.id;
                delete $scope.viewer.tabs.active_tab.new;
                $scope.viewer.tabs.active_tab.data = await $scope.event.get.app(data.package.id);
            } else {
                if (data.package.id != org_app_id) {
                    let res = await wiz.API.async("app_rename", { app_id: org_app_id, rename: data.package.id });
                    if (res.code != 200)
                        return alert(res.data);

                    // change renamed at opened tabs
                    for (let i = 0; i < $scope.viewer.tabs.data.length; i++) {
                        if ($scope.viewer.tabs.data[i].mode != 'app') continue;

                        if ($scope.viewer.tabs.data[i].org_app_id == org_app_id) {
                            $scope.viewer.tabs.data[i].org_app_id = data.package.id;
                            $scope.viewer.tabs.data[i].app_id = data.package.id;
                        }
                    }
                }
                let res = await wiz.API.async("app_update", { app_id: data.package.id, data: JSON.stringify(data) });
                if (res.code != 200)
                    return alert(res.data);
            }
        } else if (mode == 'route') {
            let is_new = $scope.viewer.tabs.active_tab.new;
            let org_app_id = $scope.viewer.tabs.active_tab.org_app_id;

            // set dic
            let dic = $scope.viewer.tabs.active_tab.dic;
            let dicv = {};
            let dickey = 'default';
            try {
                for (let key in dic.data) {
                    dickey = key;
                    if (dic.data[key].length == 0 && key != 'default') {
                        delete dic.data[key];
                        dic.list.remove(key);
                        $scope.viewer.tabs.active_tab.data.dic_selected = 'default';
                    } else {
                        dicv[key] = JSON.parse(dic.data[key]);
                    }
                }
            } catch (e) {
                return alert('Dictionary value must be JSON format (' + dickey + ')');
            }
            data.dic = $scope.viewer.tabs.active_tab.data.dic = dicv;

            // update
            if (is_new) {
                let res = await wiz.API.async("route_create", { app_id: data.package.id, data: JSON.stringify(data) });
                if (res.code != 200)
                    return alert(res.data);
                $scope.viewer.tabs.active_tab.org_app_id = data.package.id;
                $scope.viewer.tabs.active_tab.app_id = data.package.id;
                delete $scope.viewer.tabs.active_tab.new;
                $scope.viewer.tabs.active_tab.data = await $scope.event.get.route(data.package.id);
                await $scope.event.load('route');
            } else {
                if (data.package.id != org_app_id) {
                    let res = await wiz.API.async("route_rename", { app_id: org_app_id, rename: data.package.id });
                    if (res.code != 200)
                        return alert(res.data);

                    // change renamed at opened tabs
                    for (let i = 0; i < $scope.viewer.tabs.data.length; i++) {
                        if ($scope.viewer.tabs.data[i].mode != 'route') continue;
                        if ($scope.viewer.tabs.data[i].org_app_id == org_app_id) {
                            $scope.viewer.tabs.data[i].org_app_id = data.package.id;
                            $scope.viewer.tabs.data[i].app_id = data.package.id;
                        }
                    }
                }
                let res = await wiz.API.async("route_update", { app_id: data.package.id, data: JSON.stringify(data) });
                if (res.code != 200)
                    return alert(res.data);
            }
        } else {
            let item = angular.copy($scope.viewer.tabs.active_tab.data);
            let data = {};
            data.mode = mode;
            data.path = item.path;
            data.name = item.name;
            data.type = 'file';
            if (item.data.type == 'code') {
                data.type = 'code';
                data.data = item.data.data;
            }

            let res = await wiz.API.async("file_update", data);
            if (res.code != 200)
                return alert('Error on save');

            $scope.viewer.tabs.active_tab.data.path = res.data;
            $scope.viewer.tabs.active_tab.path = res.data;
            delete $scope.viewer.tabs.active_tab.new;
        }

        await $scope.event.load(mode);

        $('iframe').each(function () {
            let src = $(this).attr('src');
            $(this).attr('src', src);
        });

        await loader.init();
        await $scope.viewer.branch.changes();
        toastr.success('saved');
        await $timeout();
    }

    // search apps or routes
    $scope.event.search = async (val) => {
        val = val.toLowerCase();
        if ($scope.viewer.list.mode == 'app') {
            let searchindex = ['title', 'id'];
            for (let category in $scope.data.apps) {
                for (let i = 0; i < $scope.data.apps[category].length; i++) {
                    $scope.data.apps[category][i].hide = true;
                    for (let j = 0; j < searchindex.length; j++) {
                        try {
                            let key = searchindex[j];
                            let keyv = $scope.data.apps[category][i].package[key].toLowerCase();
                            if (keyv.includes(val)) {
                                $scope.data.apps[category][i].hide = false;
                                break;
                            }
                        } catch (e) {
                        }
                    }
                    if (val.length == 0)
                        $scope.data.apps[category][i].hide = false;
                }
            }
        } else if ($scope.viewer.list.mode == 'route') {
            let searchindex = ['title', 'id', 'route'];
            for (let i = 0; i < $scope.data.routes.length; i++) {
                $scope.data.routes[i].hide = true;
                for (let j = 0; j < searchindex.length; j++) {
                    try {
                        let key = searchindex[j];
                        let keyv = $scope.data.routes[i].package[key].toLowerCase();
                        if (keyv.includes(val)) {
                            $scope.data.routes[i].hide = false;
                            break;
                        }
                    } catch (e) {
                    }
                }
                if (val.length == 0)
                    $scope.data.routes[i].hide = false;
            }
        }

        $timeout();
    }

    // viewer
    $scope.viewer = {};

    $scope.viewer.list = (function () {
        let obj = {};
        let initialize = $scope.data.hash_id.split("/");
        let mode = 'app';
        if (initialize[0]) mode = initialize[0];
        obj.mode = mode;
        obj.show = true;
        obj.toggle = async () => {
            if (obj.show) {
                obj.show = false;
            } else {
                obj.show = true;
            }
            await $timeout();
        }

        obj.view = 'list';
        obj.change = async () => {
            if (obj.view == 'list') obj.view = 'select';
            else obj.view = 'list';
            $scope.data.search.text = "";
            await $timeout();
        }

        return obj;
    })();

    $scope.viewer.branch = (function () {
        let obj = {};
        obj.show = false;

        obj.toggle = async () => {
            if (obj.show) {
                obj.show = false;
            } else {
                obj.show = true;
                await obj.changes();
            }
            await $timeout();
        }

        obj.changes = async () => {
            let res = await wiz.API.async('git_changes');
            if (res.code == 200) {
                obj.data = res.data;
                obj.count = 0;
                for (let mode in obj.data) {
                    for (let i = 0; i < obj.data[mode].length; i++) {
                        obj.data[mode][i].color = 'bg-secondary';
                        if (obj.data[mode][i].change_type == 'M')
                            obj.data[mode][i].color = 'bg-yellow';
                        if (obj.data[mode][i].change_type == 'R')
                            obj.data[mode][i].color = 'bg-yellow';
                        if (obj.data[mode][i].change_type == 'D')
                            obj.data[mode][i].color = 'bg-red';
                        if (obj.data[mode][i].change_type == 'A')
                            obj.data[mode][i].color = 'bg-green';
                        obj.count++;
                    }
                }
            }
            await $timeout();
        }

        obj.commit = async (message) => {
            let res = await wiz.API.async("git_commit", { message: message });
            if (res.code == 200) {
                obj.message = "";
                await obj.changes();
            } else {
                await alert(res.data);
            }
        }

        obj.open = async (item) => {
            if (item.mode == 'routes') {
                let app_id = item.path.split("/")[0];
                let code = item.path.split("/")[1];
                let codemap = {
                    'controller.py': 'controller',
                    'dic.json': 'dic'
                }
                if (codemap[code]) {
                    $scope.viewer.tabs.lastcode.route = codemap[code];
                }
                await $scope.viewer.tabs.add('route', app_id);
            } else if (item.mode == 'apps') {
                let app_id = item.path.split("/")[0];
                let code = item.path.split("/")[1];
                let codemap = {
                    'socketio.py': 'socketio',
                    'api.py': 'api',
                    'dic.json': 'dic',
                    'component.jsx': 'jsx',
                    'view.scss': 'scss',
                    'view.jsx': 'view'
                }
                if (codemap[code]) {
                    $scope.viewer.tabs.lastcode.app = codemap[code];
                }
                await $scope.viewer.tabs.add('app', app_id);
            } else {
                await $scope.viewer.tabs.add(item.mode, { mode: item.mode, path: item.path, name: item.path.split("/")[item.path.split("/").length - 1], type: 'file' });
            }
        }

        return obj;
    })();

    $scope.viewer.info = (function () {
        let obj = {};
        obj.show = true;
        obj.toggle = async () => {
            if (obj.show) {
                obj.show = false;
            } else {
                obj.show = true;
            }
            await $timeout();
        }
        return obj;
    })();

    $scope.viewer.shortcut = (function () {
        let obj = {};
        obj.show = false;
        obj.toggle = async () => {
            if (obj.show) {
                obj.show = false;
            } else {
                obj.show = true;
            }
            await $timeout();
        }
        return obj;
    })();

    $scope.viewer.debug = (function () {
        let obj = {};
        obj.show = true;
        obj.toggle = async () => {
            if (obj.show) {
                obj.show = false;
            } else {
                obj.show = true;
            }
            await $timeout();
        }
        return obj;
    })();

    // tab generator
    let tab_generator = {};
    tab_generator.app = async (app_id, target) => {
        let obj = {};
        obj.id = 'wiztab-' + new Date().getTime();
        obj.mode = 'app';
        obj.data = await $scope.event.get.app(app_id);
        obj.app_id = obj.data.package.id;
        obj.org_app_id = obj.data.package.id + '';
        if (!obj.app_id) obj.new = true;

        obj.activate = async () => {
            while (!obj.editor) await $timeout(100);
            if ($scope.viewer.tabs.active_tab && $scope.viewer.tabs.active_tab.id == obj.id)
                return;
            obj.editor.focus();
            $scope.viewer.tabs.active_tab = obj;
            $scope.data.hash_id = 'app/' + obj.app_id;
            location.href = "#" + $scope.data.hash_id;
            await $timeout();
        }

        // dic builder
        if (typeof (obj.data.dic) == 'string') obj.data.dic = {};

        if ($scope.cache.apps_dic[obj.app_id]) {
            obj.dic = $scope.cache.apps_dic[obj.app_id];
        } else {
            obj.dic = {};
            obj.dic.list = ['default'];
            obj.dic.data = {};
            try {
                for (let lang in obj.data.dic) {
                    if (lang != 'default')
                        obj.dic.list.push(lang);
                    obj.dic.data[lang] = JSON.stringify(obj.data.dic[lang], null, 4);
                }
            } catch (e) {
            }
            if (!obj.dic.data.default) obj.dic.data.default = '{\n    "hello": "hello, World!"\n}';
            obj.dic.create = async (value) => {
                let test = /^[a-zA-Z]+$/.test(value);
                if (!test || value.length != 2) {
                    return alert('Language must be 2 length alphabets.');
                }
                value = value.toLowerCase();
                if (!obj.dic.data[value]) obj.dic.data[value] = '{\n    "hello": "hello, World!"\n}';
                if (!obj.dic.list.includes(value)) obj.dic.list.push(value);
                obj.dic.new = '';
                await $timeout();
            }
            $scope.cache.apps_dic[obj.app_id] = obj.dic;
        }

        obj.dic_selected = 'default';
        obj.dic.monaco = monaco_option('json', obj);

        // code builder
        obj.code = {};
        obj.code.list = ['api', 'socketio', 'jsx', 'view', 'scss', 'dic', 'preview'];
        obj.code.select = async (target) => {
            obj.show = false;
            await $timeout();
            obj.code.target = target;
            $scope.viewer.tabs.lastcode.app = target;

            if (target != 'dic' && target != 'preview') {
                let map = {
                    api: "python",
                    socketio: "python",
                    scss: "css",
                    view: "pug",
                    jsx: "javascript",
                };
                obj.monaco = monaco_option(map[target], obj);
            }

            obj.show = true;
            await $timeout();
        }

        if (!target) target = 'jsx';
        obj.code.select(target);
        return obj;
    }
    tab_generator.route = async (app_id, target) => {
        let obj = {};
        obj.id = 'editor-' + new Date().getTime();
        obj.mode = 'route';
        obj.data = await $scope.event.get.route(app_id);
        obj.app_id = obj.data.package.id;
        obj.org_app_id = obj.data.package.id + '';
        if (!obj.app_id) obj.new = true;

        obj.activate = async () => {
            while (!obj.editor) await $timeout(100);
            if ($scope.viewer.tabs.active_tab && $scope.viewer.tabs.active_tab.id == obj.id)
                return;
            obj.editor.focus();
            $scope.viewer.tabs.active_tab = obj;
            $scope.data.hash_id = 'route/' + obj.app_id;
            location.href = "#" + $scope.data.hash_id;
            await $timeout();
        }

        // dic builder
        if (typeof (obj.data.dic) == 'string') obj.data.dic = {};

        if ($scope.cache.routes_dic[obj.app_id]) {
            obj.dic = $scope.cache.routes_dic[obj.app_id];
        } else {
            obj.dic = {};
            obj.dic.list = ['default'];
            obj.dic.data = {};
            try {
                for (let lang in obj.data.dic) {
                    if (lang != 'default')
                        obj.dic.list.push(lang);
                    obj.dic.data[lang] = JSON.stringify(obj.data.dic[lang], null, 4);
                }
            } catch (e) {
            }
            if (!obj.dic.data.default) obj.dic.data.default = '{\n    "hello": "hello, World!"\n}';
            obj.dic.create = async (value) => {
                let test = /^[a-zA-Z]+$/.test(value);
                if (!test || value.length != 2) {
                    return alert('Language must be 2 length alphabets.');
                }
                value = value.toLowerCase();
                if (!obj.dic.data[value]) obj.dic.data[value] = '{\n    "hello": "hello, World!"\n}';
                if (!obj.dic.list.includes(value)) obj.dic.list.push(value);
                obj.dic.new = '';
                await $timeout();
            }

            $scope.cache.routes_dic[obj.app_id] = obj.dic;
        }

        obj.dic.monaco = monaco_option('json', obj);
        obj.dic_selected = 'default';

        // code builder
        obj.code = {};
        obj.code.list = ['controller', 'dic', 'preview'];
        obj.code.select = async (target) => {
            obj.show = false;
            await $timeout();
            obj.code.target = target;
            $scope.viewer.tabs.lastcode.route = target;

            if (target != 'dic' && target != 'preview') {
                let map = { controller: 'python' };
                obj.monaco = monaco_option(map[target], obj);
            }

            obj.show = true;
            await $timeout();
        }

        if (!target) target = 'controller';
        obj.code.select(target);
        return obj;
    }
    tab_generator.files = async (mode, item) => {
        let data = await $scope.event.get.files(mode, item);
        if (!data) {
            alert("Not supported file");
            return null;
        }
        item.data = data;

        let obj = {};
        obj.id = 'editor-' + new Date().getTime();
        obj.mode = mode;
        obj.data = item;
        obj.path = obj.data.path;

        obj.activate = async () => {
            if (obj.data.data.type == 'code') {
                while (!obj.editor) {
                    await $timeout(100);
                }
                if ($scope.viewer.tabs.active_tab && $scope.viewer.tabs.active_tab.id == obj.id)
                    return;
                obj.editor.focus();
            }
            $scope.viewer.tabs.active_tab = obj;
            await $timeout();
        }

        if (obj.data.data.type == 'code')
            obj.monaco = monaco_option(obj.data.data.lang, obj);
        if (obj.data.data.type == 'image')
            obj.data.data.data = wiz.API.url("download?mode=" + mode + "&path=" + encodeURIComponent(obj.data.data.data));

        return obj;
    }

    // file generator
    $scope.viewer.fsnew = {};
    $scope.viewer.fsnew.data = {};
    $scope.viewer.fsnew.update = async () => {
        let data = angular.copy($scope.viewer.fsnew.data);

        if (!data.name) {
            $scope.viewer.fsnew.data = {};
            await $timeout();
            return;
        }

        let res = await wiz.API.async('file_create', data);
        if (res.code != 200) {
            return alert(res.data);
        }

        $scope.viewer.fsnew.data = {};
        await $scope.event.load(data.mode);
        await $timeout();
    }

    // tab viewer
    $scope.viewer.tabs = await (async () => {
        let obj = {};

        obj.init = async () => {
            obj.active_tab = null;
            obj.data = [];

            let initialize = $scope.data.hash_id.split("/");
            let mode = 'app';
            let app_id = 'new'
            if (initialize[0]) mode = initialize[0];
            if (initialize[1]) app_id = initialize[1];

            if (mode == 'app') {
                let tab = await tab_generator.app(app_id, 'jsx');
                if (tab) {
                    obj.data.push(tab);
                    await tab.activate();
                }

                if (tab.app_id != '') {
                    tab = await tab_generator.app(app_id, 'api');
                    if (tab) obj.data.push(tab);
                }
            } else if (mode == 'route') {
                let tab = await tab_generator.route(app_id, 'controller');
                if (tab) {
                    obj.data.push(tab);
                    await tab.activate();
                }
            }
        }

        obj.lastcode = {};
        obj.lastcode.app = 'jsx';
        obj.lastcode.route = 'controller';

        obj.add = async (mode, target, location) => {
            let tab = null;
            if (mode == 'app') {
                tab = await tab_generator.app(target, obj.lastcode.app);
            } else if (mode == 'route') {
                tab = await tab_generator.route(target, obj.lastcode.route);
            } else {
                if (!target) {
                    let path = $scope.data.files[mode].path;
                    path = path.split("/");
                    path.splice(path.length - 1, 1);
                    path = path.join("/");
                    $scope.data.files[mode].path = path;
                    await $scope.event.load(mode);
                    return;
                }

                let path = $scope.data.files[mode].path;
                if (target == 'new') {
                    $scope.viewer.fsnew.data = { active: true, mode: mode, path: path, name: '', type: 'file', data: '' };
                    await $timeout();
                    return;
                }

                if (target == 'newfolder') {
                    $scope.viewer.fsnew.data = { active: true, mode: mode, path: path, name: '', type: 'folder' };
                    await $timeout();
                    return;
                }

                if (target.type == 'folder') {
                    $scope.data.files[mode].path = target.path;
                    await $scope.event.load(mode);
                    return;
                }

                for (let i = 0; i < obj.data.length; i++) {
                    if (obj.data[i].mode != mode) continue;
                    if (obj.data[i].path == target.path) {
                        await obj.data[i].activate();
                        await obj.open(obj.data[i]);
                        return;
                    }
                }

                tab = await tab_generator.files(mode, target);
            }

            if (tab) {
                if (location) {
                    obj.data.splice(location, 0, tab);
                } else {
                    obj.data.push(tab);
                }
                $scope.viewer.info.show = true;
            }

            await $timeout();

            if (tab && tab.activate)
                await tab.activate();
        }

        obj.hidden = [];

        obj.hide = async (tab) => {
            tab.hide = true;
            obj.hidden.push(tab);
            obj.data.remove(tab);
            obj.data.push(tab);
            $timeout();
        }

        obj.open = async (tab) => {
            tab.hide = false;
            obj.hidden.remove(tab);
            $timeout();
        }

        obj.remove = async (tab) => {
            let tabidx = obj.data.indexOf(tab);
            obj.data.remove(tab);

            if (tab.mode == 'app') {
                let deleted = tab.app_id;
                for (let i = 0; i < obj.data.length; i++) {
                    if (obj.data[i].mode != 'app') continue;
                    if (obj.data[i].app_id == deleted) {
                        deleted = null;
                    }
                }
                delete $scope.cache.apps[deleted];
                delete $scope.cache.apps_dic[deleted];
            } else if (tab.mode == 'route') {
                let deleted = tab.app_id;
                for (let i = 0; i < obj.data.length; i++) {
                    if (obj.data[i].mode != 'route') continue;
                    if (obj.data[i].app_id == deleted) {
                        deleted = null;
                    }
                }
                delete $scope.cache.routes[deleted];
                delete $scope.cache.routes_dic[deleted];
            }

            if (obj.active_tab.id == tab.id) {
                obj.active_tab = null;
                if (obj.data.length > 0) {
                    if (obj.data[tabidx]) {
                        await obj.data[tabidx].activate();
                    } else {
                        await obj.data[obj.data.length - 1].activate();
                    }
                }
            }

            await $timeout();
        }

        obj.monaco = async (lang) => {
            if (obj.active_tab.code.target !== "view") return;
            obj.active_tab.show = false;
            await $timeout();
            obj.active_tab.monaco = monaco_option(lang, obj.active_tab);
            await $timeout();
            obj.active_tab.show = true;
            await $timeout();
        }

        return obj;
    })();

    // shortcuts
    $scope.shortcut = {};
    $scope.shortcut.configuration = (monaco) => {
        return {
            'save': {
                key: 'Ctrl KeyS',
                desc: 'save',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S,
                fn: async () => {
                    await $scope.event.save();
                }
            },
            'tree': {
                key: 'Ctrl KeyL',
                desc: 'toggle file browser',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_L,
                fn: async () => {
                    await $scope.viewer.list.toggle();
                }
            },
            'info': {
                key: 'Ctrl KeyI',
                desc: 'toggle info panel',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_I,
                fn: async () => {
                    await $scope.viewer.info.toggle();
                }
            },
            'branch': {
                key: 'Ctrl KeyB',
                desc: 'Git Commit',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_B,
                fn: async () => {
                    await $scope.viewer.branch.toggle();
                }
            },
            'debug': {
                key: 'Ctrl KeyJ',
                desc: 'toggle debug panel',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_J,
                fn: async () => {
                    await $scope.viewer.debug.toggle();
                }
            },
            'debug_clear': {
                key: 'Ctrl KeyK',
                desc: 'clear dubug log',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_K,
                fn: async () => {
                    await $scope.socket.clear();
                }
            },
            'new_file': {
                key: 'Alt KeyN',
                desc: 'create new file',
                monaco: monaco.KeyMod.Alt | monaco.KeyCode.KEY_N,
                fn: async () => {
                    await $scope.viewer.tabs.add($scope.viewer.list.mode, 'new');
                    await $timeout();
                }
            },
            'spotlight': {
                key: 'Ctrl Shift KeyF',
                desc: 'auto focus to search form',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KEY_F,
                fn: async () => {
                    $('input#search').focus();
                }
            },

            // code shortcuts
            'code_prev': {
                key: 'Alt KeyA',
                desc: 'move prev code',
                monaco: monaco.KeyMod.Alt | monaco.KeyCode.KEY_A,
                fn: async () => {
                    if (!$scope.viewer.tabs.active_tab) return;
                    if (!$scope.viewer.tabs.active_tab.code) return;
                    if (!$scope.viewer.tabs.active_tab.code.list) return;
                    let targets = angular.copy($scope.viewer.tabs.active_tab.code.list);
                    let target = $scope.viewer.tabs.active_tab.code.target;
                    let target_idx = targets.indexOf(target);

                    target_idx = target_idx - 1;
                    if (target_idx < 0) target_idx = targets.length - 1;

                    let newtarget = targets[target_idx];
                    await $scope.viewer.tabs.active_tab.code.select(newtarget);
                    $scope.viewer.tabs.active_tab.editor.focus();

                    await $timeout();
                }
            },
            'code_next': {
                key: 'Alt KeyS',
                desc: 'move next code',
                monaco: monaco.KeyMod.Alt | monaco.KeyCode.KEY_S,
                fn: async () => {
                    if (!$scope.viewer.tabs.active_tab) return;
                    if (!$scope.viewer.tabs.active_tab.code) return;
                    if (!$scope.viewer.tabs.active_tab.code.list) return;
                    let targets = angular.copy($scope.viewer.tabs.active_tab.code.list);
                    let target = $scope.viewer.tabs.active_tab.code.target;
                    let target_idx = targets.indexOf(target);

                    target_idx = target_idx + 1;
                    if (target_idx >= targets.length) target_idx = 0;

                    let newtarget = targets[target_idx];
                    await $scope.viewer.tabs.active_tab.code.select(newtarget);
                    $scope.viewer.tabs.active_tab.editor.focus();

                    await $timeout();
                }
            },

            'new_tab': {
                key: 'Alt KeyT',
                desc: 'new tab (open active tab)',
                monaco: monaco.KeyMod.Alt | monaco.KeyCode.KEY_T,
                fn: async () => {
                    if (!$scope.viewer.tabs.active_tab) return;
                    if ($scope.viewer.tabs.active_tab.mode == 'app') {
                        let targetidx = $scope.viewer.tabs.data.indexOf($scope.viewer.tabs.active_tab);
                        $scope.viewer.tabs.add('app', $scope.viewer.tabs.active_tab.app_id, targetidx + 1);
                    } else if ($scope.viewer.tabs.active_tab.mode == 'route') {
                        let targetidx = $scope.viewer.tabs.data.indexOf($scope.viewer.tabs.active_tab);
                        $scope.viewer.tabs.add('route', $scope.viewer.tabs.active_tab.app_id, targetidx + 1);
                    }

                    await $timeout();
                }
            },
            'close_tab': {
                key: 'Alt KeyW',
                desc: 'close tab',
                monaco: monaco.KeyMod.Alt | monaco.KeyCode.KEY_W,
                fn: async () => {
                    if ($scope.viewer.tabs.active_tab)
                        $scope.viewer.tabs.remove($scope.viewer.tabs.active_tab);
                    await $timeout();
                }
            },
            'tab1': {
                key: 'Ctrl Digit1',
                desc: 'move tab 1',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.DIGIT1,
                fn: async () => {
                    if ($scope.viewer.tabs.data[0])
                        await $scope.viewer.tabs.data[0].activate();
                    await $timeout();
                }
            },
            'tab2': {
                key: 'Ctrl Digit2',
                desc: 'move tab 2',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.DIGIT2,
                fn: async () => {
                    if ($scope.viewer.tabs.data[1])
                        await $scope.viewer.tabs.data[1].activate();
                    await $timeout();
                }
            },
            'tab3': {
                key: 'Ctrl Digit3',
                desc: 'move tab 3',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.DIGIT3,
                fn: async () => {
                    if ($scope.viewer.tabs.data[2])
                        await $scope.viewer.tabs.data[2].activate();
                    await $timeout();
                }
            },
            'tab4': {
                key: 'Ctrl Digit4',
                desc: 'move tab 4',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.DIGIT4,
                fn: async () => {
                    if ($scope.viewer.tabs.data[3])
                        await $scope.viewer.tabs.data[3].activate();
                    await $timeout();
                }
            },
            'tab5': {
                key: 'Ctrl Digit5',
                desc: 'move tab 5',
                monaco: monaco.KeyMod.CtrlCmd | monaco.KeyCode.DIGIT5,
                fn: async () => {
                    if ($scope.viewer.tabs.data[4])
                        await $scope.viewer.tabs.data[4].activate();
                    await $timeout();
                }
            },
        }
    };

    // load app
    await $scope.event.load();
    await $scope.viewer.tabs.init();
    await $timeout();

    // bind shortcut
    while (!window.monaco) {
        await $timeout(100);
    }

    $scope.shortcut.bind = async () => {
        if (!window.monaco) return;
        $(window).unbind();

        let shortcut_opts = {};
        let shortcuts = $scope.shortcut.configuration(window.monaco);
        $scope.shortcut.list = angular.copy(shortcuts);

        for (let key in shortcuts) {
            let keycode = shortcuts[key].key;
            let fn = shortcuts[key].fn;
            if (!keycode) continue;
            shortcut_opts[keycode] = async (ev) => {
                ev.preventDefault();
                await fn();
            };
        }

        season.shortcut(window, shortcut_opts);
    }

    await $scope.shortcut.bind();
    window.onbeforeunload = () => "";

    /*
         * socket.io event binding for trace log
         */
    let ansi_up = new AnsiUp();
    let socket = io("/wiz");

    $scope.socket = {};
    $scope.socket.log = "";
    $scope.socket.clear = async () => {
        $scope.socket.log = "";
        await $timeout();
    }

    $scope.socket.link = async () => {
        $scope.viewer.debug.show = false;
        await $timeout();
        window.open(wiz.url + "/ui/workspace/debug", '_blank');
    }

    socket.on("connect", async () => {
        if ($scope.viewer.debug.show)
            socket.emit("join", { id: wiz.data.branch });
    });

    socket.on("log", async (data) => {
        data = ansi_up.ansi_to_html(data).replace(/\n/gim, '<br>');
        $scope.socket.log = $scope.socket.log + data;

        let logs = $scope.socket.log.split("<br>");
        let maxsize = 1000;
        if (logs.length > maxsize) {
            logs = logs.splice(logs.length - maxsize, maxsize);
            $scope.socket.log = logs.join("<br>");
        }

        await $timeout(200);
        let element = $('.debug-messages')[0];
        if (!element) return;
        element.scrollTop = element.scrollHeight - element.clientHeight;
    });

    $scope.$watch("viewer.debug.show", async () => {
        if ($scope.viewer.debug.show) {
            socket.emit("join", { id: wiz.data.branch });
        } else {
            socket.emit("leave", { id: wiz.data.branch });
        }
    }, true);
}
