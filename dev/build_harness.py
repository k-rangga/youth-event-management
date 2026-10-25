"""Builds dev/index.html: the web app page with templates inlined and google.script.run stubbed (dev/stub.js).
Serve with:  python3 -m http.server 8765 --directory dev   then open http://localhost:8765/#tata-ibadah"""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
page = open(os.path.join(root, 'Index.html')).read()
page = re.sub(r"<\?!= include\('(\w+)'\); \?>", lambda m: open(os.path.join(root, m.group(1) + '.html')).read(), page)
page = page.replace('<head>', '<head><script>' + open(os.path.join(root, 'LiturgiText.js')).read() + '</script><script src="stub.js?v=' + str(int(os.path.getmtime(os.path.join(root, 'dev', 'stub.js')))) + '"></script>', 1)
open(os.path.join(root, 'dev', 'index.html'), 'w').write(page)
print('dev/index.html built')
