import { ProductImage } from './cart-utils';

/**
 * Gets the alt text from a product image, handling different field cases
 * @param image The product image object
 * @param fallback Fallback text if no alt text is available
 * @returns The appropriate alt text
 */
export function getImageAlt(image: ProductImage | null | undefined, fallback: string = 'Product'): string {
  if (!image) return fallback;
  
  // Handle different field cases from the backend
  return image.alt || image.ALT || fallback;
}

/**
 * Gets the product image URL with a fallback
 * @param image The product image object
 * @param fallbackSrc Fallback image source
 * @returns The appropriate image source
 */
export function getImageSrc(image: ProductImage | null | undefined, fallbackSrc: string = '/images/placeholder-image.svg'): string {
  if (!image) return fallbackSrc;
  
  return image.src || fallbackSrc;
} 