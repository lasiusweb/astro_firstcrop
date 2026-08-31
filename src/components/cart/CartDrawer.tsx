import { useState, useEffect, useCallback, useRef } from 'react';
import './cart-drawer.css';

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number;
    image: string;
  };
}

const CART_OPEN_EVENT = 'firstcrop:cart-open';
const CART_UPDATED_EVENT = 'firstcrop:cart-updated';

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const close = useCallback(() => setOpen(false), []);

  // A11y: move focus into the dialog on open, restore on close
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      closeButtonRef.current?.focus();
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  // A11y: rudimentary focus trap while the drawer is open
  useEffect(() => {
    if (!open) return;
    const drawer = document.querySelector('.cart-drawer');
    if (!drawer) return;
    const focusables = drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusables.length === 0) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [open, items, loading]);

  useEffect(() => {
    const intent = (window as any).__firstcropIntent as { open?: { cart?: boolean } } | undefined;
    const onOpen = () => {
      if (intent?.open) intent.open.cart = false;
      setOpen(true);
    };
    window.addEventListener(CART_OPEN_EVENT, onOpen);
    // A click captured before this island hydrated (see StorefrontLayout's
    // `__firstcropIntent` buffer) would otherwise be lost — consume it here.
    if (intent?.open?.cart) {
      intent.open.cart = false;
      setOpen(true);
    }
    return () => window.removeEventListener(CART_OPEN_EVENT, onOpen);
  }, []);

  const fetchCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cart/get');
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to fetch cart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchCart();
  }, [open, fetchCart]);

  useEffect(() => {
    const onUpdated = () => {
      if (open) fetchCart();
    };
    window.addEventListener(CART_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdated);
  }, [open, fetchCart]);

  useEffect(() => {
    // Escape is registered once on mount and guarded by a ref so the drawer can
    // always be dismissed — attaching it conditionally after `open` commits
    // leaves a window where Escape is missed.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openRef.current) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const res = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.dispatchEvent(new CustomEvent('firstcrop:toast', {
          detail: { message: data.error || 'Could not update the cart.', variant: 'error' },
        }));
        return;
      }
      fetchCart();
      window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
    } catch {
      window.dispatchEvent(new CustomEvent('firstcrop:toast', {
        detail: { message: 'Network error. Please try again.', variant: 'error' },
      }));
    }
  };

  const removeItem = async (itemId: string) => {
    await updateQuantity(itemId, 0);
  };

  if (!open) return null;

  return (
    <div className="cart-drawer-overlay" onClick={close}>
      <div className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" onClick={(e) => e.stopPropagation()}>
        <div className="cart-drawer-header">
          <h2 className="cart-drawer-title">Cart ({items.length})</h2>
          <button ref={closeButtonRef} className="cart-drawer-close" onClick={close} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="cart-drawer-body">
          {loading ? (
            <div className="cart-drawer-empty" aria-live="polite">Loading…</div>
          ) : items.length === 0 ? (
            <div className="cart-drawer-empty">
              <p>Your cart is empty</p>
              <a href="/products" className="cart-drawer-browse" onClick={close}>Browse Products →</a>
            </div>
          ) : (
            <ul className="cart-items">
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  <img src={item.product.image} alt={item.product.name} className="cart-item-image" width="64" height="64" />
                  <div className="cart-item-info">
                    <a href={`/products/${item.product.slug}`} className="cart-item-name">{item.product.name}</a>
                    <p className="cart-item-price numeric">₹{item.product.price.toFixed(0)}</p>
                    <div className="cart-item-qty">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="cart-qty-btn" aria-label="Decrease quantity">−</button>
                      <span className="cart-qty-value numeric">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="cart-qty-btn" aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="cart-item-remove" aria-label={`Remove ${item.product.name}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-total">
              <span>Total</span>
              <span className="cart-total-amount numeric">₹{total.toFixed(0)}</span>
            </div>
            <a href="/checkout" className="cart-checkout-btn" onClick={close}>Proceed to Checkout</a>
          </div>
        )}
      </div>
    </div>
  );
}
