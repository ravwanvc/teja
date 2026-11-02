import sqlite3, pathlib, tempfile, concurrent.futures
path=tempfile.mktemp(suffix='.sqlite')
c=sqlite3.connect(path)
c.executescript(pathlib.Path('drizzle/0000_whole_kate_bishop.sql').read_text())
c.execute("INSERT INTO users VALUES ('u','Test','member',1)")
c.execute("INSERT INTO products VALUES ('p','u','Bread','Bakery','Food','img',1000,2000,5,'Address',41,69,'Wheat','Cool',9999999999999,1,1)")
c.commit()
def reserve(i):
 d=sqlite3.connect(path,timeout=10)
 try:
  d.execute("INSERT INTO orders VALUES (?, 'u','p',1,1000,'CODE','reserved',2)",(str(i),));d.commit();return True
 except sqlite3.IntegrityError:return False
 finally:d.close()
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool: results=list(pool.map(reserve,range(10)))
assert sum(results)==5
assert c.execute('SELECT stock FROM products').fetchone()[0]==0
order=c.execute('SELECT id FROM orders LIMIT 1').fetchone()[0]
c.execute("UPDATE orders SET status='cancelled' WHERE id=? AND status='reserved'",(order,));c.commit()
assert c.execute('SELECT stock FROM products').fetchone()[0]==1
c.execute("UPDATE orders SET status='cancelled' WHERE id=? AND status='reserved'",(order,));c.commit()
assert c.execute('SELECT stock FROM products').fetchone()[0]==1
for qty in (0,-1,1.5,2):
 try:c.execute("INSERT INTO orders VALUES ('bad','u','p',?,1000,'CODE','reserved',2)",(qty,));raise AssertionError('invalid qty accepted')
 except sqlite3.IntegrityError:pass
print('PASS: concurrent buyers cannot oversell; cancellation restores once; invalid quantities rejected')
c.close();pathlib.Path(path).unlink()
