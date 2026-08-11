"use client";

import React, { useState } from 'react';
import { useCart } from '../../../context/CartContext';
import { ProductRecord } from '../../../lib/product-types';

type AddToBagButtonProps = {
  product: ProductRecord;
  variant?: string;
  disabled?: boolean;
};

export function AddToBagButton({ product, variant, disabled = false }: AddToBagButtonProps) {
  const { addToCart } = useCart();
  const [status, setStatus] = useState<'idle' | 'added'>('idle');

  const handleAdd = async () => {
    if (disabled) return;
    const ok = await addToCart(product, variant);
    if (!ok) return;
    setStatus('added');
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <button 
      className={`add-to-bag-btn ${status === 'added' ? 'added' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleAdd}
      disabled={disabled}
    >
      <span className="btn-text">
        {status === 'added' ? 'Added ✓' : 'Add to Basket'}
      </span>
      
      <style jsx>{`
        .add-to-bag-btn {
          width: 100%;
          background: #1a1816;
          color: #fff;
          border: none;
          padding: 18px 32px;
          border-radius: 100px;
          font-weight: 700;
          font-size: 0.9rem;
          text-transform: none;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          position: relative;
          overflow: hidden;
        }

        .add-to-bag-btn:hover:not(.disabled) {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }

        .add-to-bag-btn.added {
          background: #7d9b8a; /* Sage Green for success */
        }

        .add-to-bag-btn.disabled {
          background: #e0e0e0;
          color: #a0a0a0;
          cursor: not-allowed;
        }

        .btn-text {
          position: relative;
          z-index: 1;
        }

        /* Mobile Sticky Logic (handled via parent container in real pages usually, but can be forced here) */
        @media (max-width: 768px) {
          .add-to-bag-btn {
            font-size: 0.85rem;
            padding: 16px 24px;
          }
        }
      `}</style>
    </button>
  );
}
