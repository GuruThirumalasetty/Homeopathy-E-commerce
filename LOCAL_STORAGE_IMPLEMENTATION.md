# Local Storage Implementation for User-Specific Data

## Overview
This implementation saves and manages user-specific data in browser local storage:
- **Cart items** - Products added to cart by each user
- **Orders** - Purchase history for each user
- **Transactions** - Payment records for each user

All data is bound to the logged-in user ID to ensure data isolation between users.

## How It Works

### Storage Keys
Each user's data is stored with a unique key format:
```
{dataType}-{userId}
```

Examples:
- `bookstore-cart-user-1234567890` - Cart for user with ID "user-1234567890"
- `bookstore-orders-user-1234567890` - Orders for same user
- `bookstore-transactions-user-1234567890` - Transactions for same user

### Key Methods in AppStateService

#### `loadUserData()`
Called after user login or registration. Restores all user-specific data from local storage:
```typescript
loadUserData(): void {
  this.cartSignal.set(this.restoreCart());
  this.ordersSignal.set(this.restoreOrders());
  this.transactionsSignal.set(this.restoreTransactions());
}
```

#### `clearUserData()`
Called on user logout. Removes all user-specific data from local storage and clears signals:
```typescript
clearUserData(): void {
  const userId = this.getCurrentUserId();
  if (userId) {
    localStorage.removeItem(`${CART_STORAGE_KEY}-${userId}`);
    localStorage.removeItem(`${ORDERS_STORAGE_KEY}-${userId}`);
    localStorage.removeItem(`${TRANSACTIONS_STORAGE_KEY}-${userId}`);
  }
  this.cartSignal.set([]);
  this.ordersSignal.set([]);
  this.transactionsSignal.set([]);
}
```

#### `getStorageKey(baseKey)`
Generates user-specific storage key:
```typescript
private getStorageKey(baseKey: string): string {
  const userId = this.getCurrentUserId();
  return userId ? `${baseKey}-${userId}` : baseKey;
}
```

### Data Persistence Points

#### Cart Persistence
- Saved every time cart changes:
  - `addToCart()`
  - `removeFromCart()`
  - `updateCartQuantity()`
  - `clearCart()`

#### Orders Persistence
- Saved when:
  - Order is placed via `placeOrder()`
  - Order status is updated via `updateOrderStatus()`

#### Transactions Persistence
- Saved when:
  - Transaction is created via `addTransaction()`

## Authentication Integration

### Login Flow
1. User successfully logs in via `AuthService.login()`
2. User is set in AuthService
3. **`appState.loadUserData()` is called** - Loads user's cart, orders, and transactions
4. User sees their saved data

### Registration Flow
1. New user registers via `AuthService.register()`
2. User is auto-logged in
3. **`appState.loadUserData()` is called** - Starts fresh (empty data)
4. User's new cart/orders/transactions are saved as they interact

### Logout Flow
1. User clicks logout
2. **`appState.clearUserData()` is called** - Removes all user data from storage
3. User signals are cleared
4. User is redirected to login page

## Data Structure

### Cart Item (CartItem)
```typescript
{
  id: number;
  title: string;
  author: string;
  price: number;
  image: string;
  quantity: number;
  type: 'book' | 'video';
  rating: number;
  category: string;
}
```

### Order
```typescript
{
  id: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: string;
  deliveryDate?: string;
}
```

### Transaction
```typescript
{
  id: string;
  orderId: string;
  amount: number;
  status: 'success' | 'failed' | 'pending';
  method: 'card' | 'upi' | 'netbanking' | 'wallet';
  createdAt: string;
}
```

## Example Scenario

### User A's Journey
1. **Login**: User A (ID: "user-1001") logs in
   - Local storage restores: `bookstore-cart-user-1001`, `bookstore-orders-user-1001`, `bookstore-transactions-user-1001`
   
2. **Add to Cart**: Adds "Angular Book" to cart
   - Saved to: `bookstore-cart-user-1001`
   
3. **Place Order**: Completes purchase
   - Order saved to: `bookstore-orders-user-1001`
   - Transaction saved to: `bookstore-transactions-user-1001`
   - Cart cleared
   
4. **Logout**: Ends session
   - All User A data removed from memory
   - Data still in local storage under `user-1001` keys

### User B's Journey
1. **Login**: User B (ID: "user-2002") logs in
   - Local storage restores: `bookstore-cart-user-2002`, `bookstore-orders-user-2002`, `bookstore-transactions-user-2002`
   - User B sees their own data (different from User A)
   
2. **Browse**: User B's actions only affect their own storage keys

## Browser Storage
All data is stored in browser's localStorage with JSON serialization:
```javascript
localStorage.getItem('bookstore-cart-user-1001') // Returns JSON string of cart items
localStorage.getItem('bookstore-orders-user-1001') // Returns JSON string of orders
localStorage.getItem('bookstore-transactions-user-1001') // Returns JSON string of transactions
```

## Important Notes

1. **Isolation**: Each user's data is isolated by their unique user ID
2. **Automatic Cleanup**: `clearUserData()` removes user's data on logout
3. **Persistence**: Data survives browser refresh (until logged out)
4. **Reactive**: Angular signals ensure UI updates when data changes
5. **Error Handling**: Try-catch blocks prevent JSON parsing errors

## Testing Local Storage

In browser console:
```javascript
// View User A's cart
localStorage.getItem('bookstore-cart-user-1001');

// View User A's orders
localStorage.getItem('bookstore-orders-user-1001');

// View User A's transactions
localStorage.getItem('bookstore-transactions-user-1001');

// Clear all storage
localStorage.clear();
```
