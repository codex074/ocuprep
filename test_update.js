import { createClient } from '@supabase/supabase-js';

const url = 'https://ksgvuqserhzwraleyymq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZ3Z1cXNlcmh6d3JhbGV5eW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDQ5MzUsImV4cCI6MjA4NjcyMDkzNX0.VjLdMJFoc6o8pdzW_fpUWQiBNTay0qGaeqQfCj52pj4';

const supabase = createClient(url, key);

async function test() {
  console.log('Testing update...');
  try {
    // Attempting to update user with id 1
    const { data, error } = await supabase
      .from('users')
      .update({ profile_image: '/avatars/male-pharmacist.png' })
      .eq('id', 1)
      .select();

    if (error) {
      console.error('Update Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Update Success:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();
