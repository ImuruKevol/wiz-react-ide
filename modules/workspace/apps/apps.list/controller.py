# react = wiz.server.wiz.model('react/main')("apps")
# fs = react.fs()
# print(fs.files())
# print(react.load("auth.signin").data(False))


try: category = wiz.server.wiz.config("wiz").get('category')
except: category = wiz.server.config.wiz.category
kwargs['category'] = category