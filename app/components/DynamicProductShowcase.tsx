"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductRecord } from '../../lib/product-types';

interface DynamicProductShowcaseProps {
  products: ProductRecord[];
  pos: { x: number; y: number };
}

// Fixed slots for the asymmetrical layout on the right side
const SLOTS = [
  { x: 58, y: 12, scale: 0.92, z: 1, delay: 0 },
  { x: 78, y: 28, scale: 1.15, z: 10, delay: 0.2 }, // Hero item
  { x: 62, y: 48, scale: 0.88, z: 2, delay: 0.1 },
  { x: 84, y: 62, scale: 1.02, z: 5, delay: 0.3 },
  { x: 70, y: 82, scale: 0.96, z: 3, delay: 0.15 },
];

export function DynamicProductShowcase({ products, pos }: DynamicProductShowcaseProps) {
  // We keep track of which product index is in which slot
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
  const [nextToReplace, setNextToReplace] = useState(0);

  // Initialize with first 5 products or featured ones
  useEffect(() => {
    if (products && products.length >= 5) {
      // Prefer products with 'featured' tag if possible, but for now just first 5
      setVisibleIndices([0, 1, 2, 3, 4]);
    }
  }, [products]);

  // Rotation logic: Replace one product every 5 seconds
  useEffect(() => {
    if (!products || products.length <= 5) return;

    const interval = setInterval(() => {
      setVisibleIndices(prev => {
        if (prev.length === 0) return prev;
        
        const next = [...prev];
        const currentProducts = new Set(prev);
        
        // Find a random product not currently visible
        let newIdx = Math.floor(Math.random() * products.length);
        let attempts = 0;
        while (currentProducts.has(newIdx) && attempts < 20) {
          newIdx = (newIdx + 1) % products.length;
          attempts++;
        }

        next[nextToReplace] = newIdx;
        setNextToReplace(n => (n + 1) % 5);
        return next;
      });
    }, 5500); // 5.5 seconds rotation cycle

    return () => clearInterval(interval);
  }, [products, nextToReplace]);

  if (!products || products.length < 5 || visibleIndices.length < 5) return null;

  return (
    <div 
      className="dynamic-product-showcase"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: 5,
        overflow: 'hidden'
      }}
    >
      {SLOTS.map((slot, slotIdx) => {
        const productIdx = visibleIndices[slotIdx];
        const product = products[productIdx];
        
        if (!product) return null;

        return (
          <div
            key={`slot-container-${slotIdx}`}
            style={{
              position: 'absolute',
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: '240px',
              height: '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: slot.z
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={product.id}
                initial={{ 
                  opacity: 0, 
                  y: 20, 
                  scale: 0.96 
                }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: {
                    duration: 1.2,
                    ease: [0.4, 0, 0.2, 1],
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  y: -20, 
                  scale: 0.96,
                  transition: {
                    duration: 1.0,
                    ease: [0.4, 0, 0.2, 1]
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  scale: slot.scale // Apply slot scale to the whole motion div
                }}
              >
                {/* Breathing / Float effect */}
                <motion.div
                  animate={{
                    y: [0, -5, 0],
                    x: [0, 3, 0],
                    rotate: [0, 1, 0]
                  }}
                  transition={{
                    duration: 7 + slotIdx, // Vary duration for organic feel
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: slotIdx * 0.4
                  }}
                  className="showcase-item-visual"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      filter: 'drop-shadow(0 25px 45px rgba(0,0,0,0.12)) grayscale(0.1) sepia(0.08)',
                      transition: 'filter 0.3s ease'
                    }}
                  />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
