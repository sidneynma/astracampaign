import { useState, useEffect } from 'react';
import { User, UsersResponse } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseUsersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useUsers({ search, page = 1, pageSize = 20 }: UseUsersParams = {}) {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Helper para fazer requisições autenticadas
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const loadUsers = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (search) {
        params.set('search', search);
      }

      const response = await authenticatedFetch(`/api/users?${params}`);

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }

      const responseData = await response.json();
      const data: UsersResponse = responseData.data || responseData;
      setUsers(data.users);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const response = await authenticatedFetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar usuário');
      }

      await loadUsers();
      return true;
    } catch (err) {
      console.error('Erro ao deletar usuário:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, page, pageSize, isAuthenticated]);

  return {
    users,
    total,
    totalPages,
    loading,
    error,
    refresh: loadUsers,
    deleteUser,
  };
}