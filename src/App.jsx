import { useEffect, useMemo, useState } from "react";
import { CATS, PRODUCTS } from "./data.js";
import HandsFree from "./HandsFree.jsx";

const inr = n => "₹" + n.toLocaleString("en-IN");
const stars = r => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

function usePersisted(key, init) {
  const [v, set] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, set];
}

function Card({ p, onOpen, onAdd, liked, onLike }) {
  return (
    <article className="card">
      <button className="tile" style={{ "--h": p.hue }} onClick={() => onOpen(p)} aria-label={`View ${p.name}`}>
        <span className="emoji">{p.emoji}</span>
        {p.tag && <span className="tag">{p.tag}</span>}
      </button>
      <button className={"heart" + (liked ? " on" : "")} onClick={() => onLike(p.id)} aria-label="Wishlist">{liked ? "♥" : "♡"}</button>
      <div className="info">
        <h3>{p.name}</h3>
        <div className="rate"><span>{stars(p.rating)}</span> {p.rating} ({p.reviews})</div>
        <div className="row">
          <div><strong>{inr(p.price)}</strong> <s>{inr(p.old)}</s></div>
          <button className="btn sm" onClick={() => onAdd(p.id)}>Add</button>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [theme, setTheme] = usePersisted("nook-theme", "light");
  const [cart, setCart] = usePersisted("nook-cart", {});
  const [wish, setWish] = usePersisted("nook-wish", []);
  const [orders, setOrders] = usePersisted("nook-orders", []);
  const [view, setView] = useState("shop"); // shop | wish | checkout | done
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("featured");
  const [maxP, setMaxP] = useState(6000);
  const [quick, setQuick] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponIn, setCouponIn] = useState("");
  const [toast, setToast] = useState("");
  const [mode, setMode] = useState("off");
  const [lastOrder, setLastOrder] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", pay: "cod" });

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const add = (id, n = 1) => { setCart(c => ({ ...c, [id]: (c[id] || 0) + n })); setToast(`Added ${byId[id].name}`); };
  const setQty = (id, d) => setCart(c => { const n = (c[id] || 0) + d; const x = { ...c }; n > 0 ? (x[id] = n) : delete x[id]; return x; });
  const like = id => setWish(w => (w.includes(id) ? w.filter(i => i !== id) : [...w, id]));

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId[id], qty })).filter(l => l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const discount = coupon === "SAVE10" ? Math.round(subtotal * 0.1) : 0;
  const shipping = !subtotal || subtotal >= 999 || coupon === "FREESHIP" ? 0 : 79;
  const total = subtotal - discount + shipping;
  const applyCoupon = () => {
    const c = couponIn.trim().toUpperCase();
    if (["SAVE10", "FREESHIP"].includes(c)) { setCoupon(c); setToast(`Coupon ${c} applied`); } else setToast("Invalid coupon");
  };

  const list = useMemo(() => {
    let r = PRODUCTS.filter(p => (cat === "All" || p.cat === cat) && p.price <= maxP && p.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === "low") r = [...r].sort((a, b) => a.price - b.price);
    if (sort === "high") r = [...r].sort((a, b) => b.price - a.price);
    if (sort === "rating") r = [...r].sort((a, b) => b.rating - a.rating);
    return r;
  }, [q, cat, sort, maxP]);

  const place = e => {
    e.preventDefault();
    const o = { id: "NK" + Date.now().toString().slice(-7), items: lines.map(l => ({ name: l.p.name, qty: l.qty })), total, ...form, date: new Date().toISOString() };
    setOrders(os => [o, ...os]); setLastOrder(o); setCart({}); setCoupon(""); setView("done");
  };
  const go = v => { setView(v); setDrawer(false); };
  const grid = items => (
    <div className="grid">
      {items.map(p => <Card key={p.id} p={p} onOpen={setQuick} onAdd={add} liked={wish.includes(p.id)} onLike={like} />)}
    </div>
  );

  return (
    <>
      <header className="top">
        <button className="logo" onClick={() => go("shop")}>E-Buy<span>.</span></button>
        <input className="search" placeholder="Search products" value={q} onChange={e => { setQ(e.target.value); setView("shop"); }} />
        <nav>
          <button className="nav" onClick={() => go("shop")}>Shop</button>
          <button className="nav" onClick={() => go("wish")}>♥ <b>{wish.length}</b></button>
          <button className="nav" onClick={() => setDrawer(true)}>🛒 <b>{count}</b></button>
          <button className="nav" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Theme">{theme === "light" ? "🌙" : "☀️"}</button>
        </nav>
      </header>

      <main className="wrap">
        {view === "shop" && (
          <>
            <section className="hero">
              <div>
                <h1>Shop without touching a thing.</h1>
                <p>Steer with your eyes or one hand. Wink or pinch to buy. Everyday goods, delivered in three days.</p>
                <div className="cta">
                  <button className="btn big" onClick={() => setMode("eye")}>👁 Try eye mode</button>
                  <button className="btn big ghost" onClick={() => setMode("finger")}>✋ Try finger mode</button>
                </div>
              </div>
              <div className="collage" aria-hidden="true">
                {PRODUCTS.filter(p => [1, 6, 9, 4].includes(p.id)).map(p => <div key={p.id} className="tile" style={{ "--h": p.hue }}><span className="emoji">{p.emoji}</span></div>)}
              </div>
            </section>

            <div className="bar">
              <div className="chips">{CATS.map(c => <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
              <label className="ctl">Sort
                <select value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="featured">Featured</option><option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option><option value="rating">Top rated</option>
                </select>
              </label>
              <label className="ctl">Up to {inr(maxP)}
                <input type="range" min="500" max="6000" step="500" value={maxP} onChange={e => setMaxP(+e.target.value)} />
              </label>
            </div>
            {list.length ? grid(list) : <p className="empty">No products match. Clear the search or raise the price limit.</p>}
          </>
        )}

        {view === "wish" && (
          <>
            <h2>Your wishlist</h2>
            {wish.length ? grid(wish.map(i => byId[i]).filter(Boolean)) : <p className="empty">Tap ♡ on any product to save it here.</p>}
          </>
        )}

        {view === "checkout" && (
          <form className="checkout" onSubmit={place}>
            <div>
              <h2>Delivery details</h2>
              <input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input required placeholder="Phone number" inputMode="tel" pattern="[0-9+ ]{10,14}" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <textarea required placeholder="Full address" rows="3" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <div className="pay">
                {[["cod", "Cash on delivery"], ["upi", "UPI"], ["card", "Card"]].map(([v, l]) => (
                  <label key={v} className={form.pay === v ? "on" : ""}><input type="radio" name="pay" checked={form.pay === v} onChange={() => setForm({ ...form, pay: v })} />{l}</label>
                ))}
              </div>
            </div>
            <aside className="sum">
              <h2>Order summary</h2>
              {lines.map(l => <div key={l.p.id} className="sline"><span>{l.p.emoji} {l.p.name} × {l.qty}</span><span>{inr(l.p.price * l.qty)}</span></div>)}
              <div className="sline"><span>Discount</span><span>−{inr(discount)}</span></div>
              <div className="sline"><span>Shipping</span><span>{shipping ? inr(shipping) : "Free"}</span></div>
              <div className="sline tot"><span>Total</span><span>{inr(total)}</span></div>
              <button className="btn big" type="submit" disabled={!lines.length}>Place order</button>
            </aside>
          </form>
        )}

        {view === "done" && lastOrder && (
          <div className="done">
            <div className="big-emoji">🎉</div>
            <h2>Order {lastOrder.id} placed</h2>
            <p>Thank you, {lastOrder.name}. We’ll deliver to your address within 3 days. Total {inr(lastOrder.total)}.</p>
            <button className="btn big" onClick={() => go("shop")}>Keep shopping</button>
            <p className="mute">{orders.length} order(s) saved on this device.</p>
          </div>
        )}
      </main>

      <footer className="foot wrap">E-Buy · Frontend-only demo · Cart, wishlist and orders are saved in your browser.</footer>

      {quick && (
        <div className="overlay" onClick={() => setQuick(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <div className="tile big" style={{ "--h": quick.hue }}><span className="emoji">{quick.emoji}</span></div>
              <h2>{quick.name}</h2>
              <div className="rate"><span>{stars(quick.rating)}</span> {quick.rating} · {quick.reviews} reviews</div>
              <p>{quick.desc}</p>
              <div className="row"><div><strong className="price">{inr(quick.price)}</strong> <s>{inr(quick.old)}</s></div></div>
              <div className="cta">
                <button className="btn big" onClick={() => { add(quick.id); setQuick(null); }}>Add to cart</button>
                <button className="btn big ghost" onClick={() => like(quick.id)}>{wish.includes(quick.id) ? "♥ Saved" : "♡ Save"}</button>
                <button className="btn big ghost" onClick={() => setQuick(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {drawer && (
        <div className="overlay" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <div className="dhead"><h2>Your cart ({count})</h2><button className="btn sm ghost" onClick={() => setDrawer(false)}>Close</button></div>
            <div className="drawer-body">
              {!lines.length && <p className="empty">Your cart is empty.</p>}
              {lines.map(l => (
                <div key={l.p.id} className="dline">
                  <div className="tile mini" style={{ "--h": l.p.hue }}><span className="emoji">{l.p.emoji}</span></div>
                  <div className="dtxt"><b>{l.p.name}</b><span>{inr(l.p.price)}</span></div>
                  <div className="qty"><button className="btn sm" onClick={() => setQty(l.p.id, -1)}>−</button><b>{l.qty}</b><button className="btn sm" onClick={() => setQty(l.p.id, 1)}>+</button></div>
                </div>
              ))}
              {!!lines.length && (
                <div className="coupon">
                  <input placeholder="Coupon (SAVE10 / FREESHIP)" value={couponIn} onChange={e => setCouponIn(e.target.value)} />
                  <button className="btn sm" onClick={applyCoupon}>Apply</button>
                </div>
              )}
            </div>
            <div className="dfoot">
              <div className="sline"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
              <div className="sline"><span>Discount</span><span>−{inr(discount)}</span></div>
              <div className="sline"><span>Shipping {subtotal < 999 && subtotal > 0 ? "(free over ₹999)" : ""}</span><span>{shipping ? inr(shipping) : "Free"}</span></div>
              <div className="sline tot"><span>Total</span><span>{inr(total)}</span></div>
              <button className="btn big" disabled={!lines.length} onClick={() => go("checkout")}>Checkout</button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      <HandsFree mode={mode} setMode={setMode} />
    </>
  );
}
