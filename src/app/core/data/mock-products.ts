import { Product } from '../models/product';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    price: 299,
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400',
    rating: 4.5,
    type: 'book',
    category: 'fiction',
    description:
      'A classic American novel set in the Jazz Age, following the mysterious millionaire Jay Gatsby and his obsession with Daisy Buchanan.',
    previewPages: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800',
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800'
    ]
  },
  {
    id: 2,
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    price: 349,
    image: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400',
    rating: 4.8,
    type: 'book',
    category: 'fiction',
    description: 'A gripping tale of racial injustice and childhood innocence in the American South.',
    previewPages: [
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
    ]
  },
  {
    id: 3,
    title: '1984',
    author: 'George Orwell',
    price: 279,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    rating: 4.7,
    type: 'book',
    category: 'fiction',
    description: 'A dystopian social science fiction novel about totalitarian control.',
    previewPages: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800'
    ]
  },
  {
    id: 4,
    title: 'Master React in 10 Hours',
    instructor: 'John Doe',
    price: 999,
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400',
    rating: 4.9,
    type: 'video',
    category: 'programming',
    description:
      'Learn React from scratch with this comprehensive course covering hooks, context, and modern React patterns.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 5,
    title: 'Complete Python Course',
    instructor: 'Jane Smith',
    price: 1299,
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
    rating: 4.8,
    type: 'video',
    category: 'programming',
    description: 'Master Python programming from basics to advanced topics.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 6,
    title: 'Business Strategy Masterclass',
    author: 'Robert Johnson',
    price: 599,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    rating: 4.6,
    type: 'book',
    category: 'business',
    description: 'Learn the fundamentals of business strategy and leadership.',
    previewPages: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800',
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800'
    ]
  },
  {
    id: 7,
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    price: 449,
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400',
    rating: 4.9,
    type: 'book',
    category: 'science',
    description: 'Explore the universe and the nature of time in this groundbreaking work.',
    previewPages: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800'
    ]
  },
  {
    id: 8,
    title: 'World War II: Complete History',
    author: 'David Miller',
    price: 399,
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400',
    rating: 4.4,
    type: 'book',
    category: 'history',
    description: 'Comprehensive account of the Second World War.',
    previewPages: [
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800',
      'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800'
    ]
  },
  {
    id: 9,
    title: 'JavaScript Fundamentals',
    instructor: 'Mike Wilson',
    price: 799,
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400',
    rating: 4.7,
    type: 'video',
    category: 'programming',
    description: 'Master JavaScript from basics to advanced concepts.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 10,
    title: 'Digital Marketing Course',
    instructor: 'Sarah Brown',
    price: 1199,
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
    rating: 4.5,
    type: 'video',
    category: 'business',
    description: 'Learn digital marketing strategies and techniques.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
];

