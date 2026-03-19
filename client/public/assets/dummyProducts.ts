import { Product } from '../../src/utils/types';

export const dummyProducts: Product[] = [
  { id: 'p1', title: 'Red Dress', description: 'Elegant red dress', price: 79.99, image: '/red-dress.svg' },
  { id: 'p2', title: 'Blue Dress', description: 'Casual blue dress', price: 59.5, image: '/blue-dress.svg' },
  { id: 'p3', title: 'Green Dress', description: 'Summer green dress', price: 49.0, image: '/green-dress.svg' },
  {id:'product4', title: 'mens wear', description:"casual wear for all time", price: 199, sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['mens-1.jpeg', 'mens-2.jpeg', 'mens-3.jpeg'] },
  {id:'product5', title: 'womens dress', description:"casual wear for winter time", price: 229, sizes:['Xs', 'S', 'L', 'M', 'XL'], images: ['womens-1.jpeg', 'womens-2.jpeg', 'womens-3.jpeg'] }

];
