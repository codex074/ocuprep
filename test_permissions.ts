
// Mock data and user states
const preps = [
  { id: 1, prepared_by: 'User A', target: 'Test' },
  { id: 2, prepared_by: 'User B', target: 'Test' }
];

const checkPermission = (user: { name: string, role: string }, prepId: number) => {
  const prep = preps.find(p => p.id === prepId);
  if (!prep) return 'Not Found';
  
  if (user.role === 'admin' || user.name === prep.prepared_by) {
    return 'Allowed';
  }
  return 'Denied';
};

// Test Cases
const admin = { name: 'Admin', role: 'admin' };
const userA = { name: 'User A', role: 'user' };
const userB = { name: 'User B', role: 'user' };

console.log('--- Permission Tests ---');
console.log('1. Admin deletes User A prep:', checkPermission(admin, 1)); // Expected: Allowed
console.log('2. User A deletes User A prep:', checkPermission(userA, 1)); // Expected: Allowed
console.log('3. User A deletes User B prep:', checkPermission(userA, 2)); // Expected: Denied
console.log('4. User B deletes User A prep:', checkPermission(userB, 1)); // Expected: Denied
