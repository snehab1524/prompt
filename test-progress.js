const fetch = require('node-fetch');

async function testGetProgress() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InNuZWhhYmFqYWo0MTI4NEBnbWFpbC5jb20iLCJpYXQiOjE3NzU1NzExMTl9.7gL0_ZV9RzkkyPNkFbUW2pzTF01grTPQMhgkWfj6whw';

  try {
    const response = await fetch('http://localhost:7000/get-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email: 'snehabajaj41284@gmail.com' })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Progress data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testGetProgress();