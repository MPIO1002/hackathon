'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OAuth2Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processLogin = async () => {
      const token = searchParams.get('token');
      
      if (token) {
        try {
          // Save token to localStorage
          localStorage.setItem('authToken', token);
          
          // Fetch user profile immediately
          const response = await fetch('http://localhost:8080/api/users/profile', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const userData = await response.json();
            // Store user data to trigger immediate update
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      }

      // Redirect to home
      router.push('/');
    };

    processLogin();
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
}
