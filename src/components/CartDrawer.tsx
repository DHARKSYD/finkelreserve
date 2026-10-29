import { Link } from "@tanstack/react-router";
import { sizeWithUnit } from "@/lib/box";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, cartKey } from "@/lib/store";
import { formatNGN } from "@/lib/currency";

export function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-surface border-l border-border z-[70] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="font-display font-black text-2xl">Your Bag</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {items.length} item{items.length !== 1 && "s"}
                </p>
              </div>
              <button
                onClick={close}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 && (
                <div className="h-full grid place-items-center text-center py-20">
                  <div>
                    <div className="mx-auto h-16 w-16 rounded-full glass grid place-items-center mb-4">
                      <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Your bag is empty.</p>
                    <Link
                      onClick={close}
                      to="/shop"
                      className="inline-block mt-5 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm"
                    >
                      Browse drops
                    </Link>
                  </div>
                </div>
              )}
              {items.map((i) => {
                const k = cartKey(i);
                return (
                  <div key={k} className="flex gap-4 glass rounded-xl p-3">
                    <img
                      src={i.image}
                      alt={i.name}
                      className="h-24 w-20 object-cover rounded-lg"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{i.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sizeWithUnit(i.size, i.unit, i.bottlesPerUnit)}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1 bg-surface-2 rounded-full p-1">
                          <button
                            onClick={() => setQty(k, i.qty - 1)}
                            className="h-6 w-6 grid place-items-center rounded-full hover:bg-background"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs w-5 text-center font-semibold">{i.qty}</span>
                          <button
                            onClick={() => setQty(k, i.qty + 1)}
                            className="h-6 w-6 grid place-items-center rounded-full hover:bg-background"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="font-display font-bold">{formatNGN(i.price * i.qty)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(k)}
                      className="self-start text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {items.length > 0 && (
              <div className="border-t border-border p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-display font-black text-xl">{formatNGN(subtotal())}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipping & taxes calculated at checkout.
                </p>
                <Link
                  to="/cart"
                  onClick={close}
                  className="block text-center w-full py-4 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition"
                >
                  Checkout
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
