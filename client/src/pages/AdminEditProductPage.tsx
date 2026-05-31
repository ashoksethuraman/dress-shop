import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AddProductForm from '../components/AddProduct';
import { useGetProductByIdQuery } from '../store/apiSlice';
import Loader from '../components/Loader';

export default function AdminEditProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading, isError } = useGetProductByIdQuery(id as string);

  if (isLoading) return <Loader fullPage />;
  if (isError || !product) return (
    <div className="p-6 bg-white rounded-lg shadow">Product not found.</div>
  );

  return (
    <div className="p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-gray-500">← Back</button>
      <AddProductForm
        productToEdit={product}
        onSaved={() => navigate('/admin')}
      />
    </div>
  );
}
