import React from 'react';
import type { FilterParams } from '../../hooks/useFilters';
import { PRODUCT_TYPE_ITEMS, CATEGORIES } from '../../config/productTypes';
import { FiGrid, FiUser, FiUsers } from 'react-icons/fi';
import { FaTshirt } from "react-icons/fa";
import { MdNightsStay, MdGirl, MdWoman, MdOutlineDirectionsWalk, MdOutlineDirectionsRun } from 'react-icons/md';
// import { GiTShirt } from 'react-icons/gi';

type Props = {
  value: FilterParams;
  onChange?: (f: FilterParams) => void;
};

export default function Filter({ value, onChange }: Props) {
  const val: FilterParams = Object.assign({ category: 'ALL', type: 'ALL', q: '' }, value || {} as FilterParams) as FilterParams;

  const CategoryIcon = (key: string) => {
    switch (key) {
      case 'WOMEN': return <MdWoman className="w-4 h-4" />;
      case 'MEN': return <MdOutlineDirectionsWalk className="w-4 h-4" />;
      case 'GIRLS': return <MdGirl className="w-6 h-6" />;
      case 'BOYS': return <MdOutlineDirectionsRun className="w-4 h-4" />;
      default: return <FiGrid className="w-4 h-4" />;
    }
  };

  const TypeIcon = (key: string) => {
    switch (key) {
      case 'PYJAMA': return <MdNightsStay className="w-4 h-4" />;
      case 'T-SHIRTS': return <FaTshirt className="w-4 h-4" />;
      default: return <FiGrid className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-2">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 sm:p-2 relative">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">

          {/* Category */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="hidden sm:flex w-8 h-8 rounded-full bg-pink-100 items-center justify-center">
                <FiGrid className="w-4 h-4 text-pink-500" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Category
                </h3>
              </div>
            </div>

            <div className="flex gap-2 flex-nowrap overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-transparent hover:scrollbar-thumb-pink-300">

              {CATEGORIES.filter(c => c.enabled).map((c) => {
                const selected = val.category === c.key;

                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      onChange?.({
                        ...val,
                        category: c.key
                      } as FilterParams);
                    }}
                    className={`
                    h-7
                    px-2
                    !rounded-md
                    text-xs
                    font-medium
                    transition-all
                    duration-200
                    flex
                    items-center
                    gap-1.5
                    shrink-0
                    border
                    ${selected
                        ? "bg-pink-500 text-white border-pink-500 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-pink-300"}
                  `}
                  >
                    {c.key !== "ALL" && (
                      <span className="w-4 h-4 flex items-center justify-center">
                        {CategoryIcon(c.key)}
                      </span>
                    )}

                    <span className="whitespace-nowrap">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block absolute left-1/2 top-6 bottom-6 w-px bg-slate-100"></div>

          {/* Product Type */}
          <div className="flex flex-col lg:items-end lg:text-right">

            <div className="flex items-center gap-3 mb-3 lg:flex-row-reverse">

              <div className="hidden sm:flex w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                <FaTshirt className="w-4 h-4 text-emerald-500" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Product Type
                </h3>
              </div>
            </div>

            <div className="flex lg:justify-end overflow-x-auto pb-2 w-full scrollbar-thin scrollbar-thumb-emerald-200 scrollbar-track-transparent hover:scrollbar-thumb-emerald-300">

              <div className="flex gap-2 flex-nowrap">

                {PRODUCT_TYPE_ITEMS.filter(f => f.enabled).map((f) => {
                  const selected = val.type === f.key;

                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        onChange?.({
                          ...val,
                          type: f.key
                        } as FilterParams);
                      }}
                      className={`
                      h-7
                      px-2
                      !rounded-md
                      text-xs
                      font-medium
                      transition-all
                      duration-200
                      flex
                      items-center
                      gap-1.5
                      shrink-0
                      border
                      ${selected
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"}
                    `}
                    >
                      {f.key !== "ALL" && (
                        <span className="w-4 h-4 flex items-center justify-center">
                          {TypeIcon(f.key)}
                        </span>
                      )}

                      <span className="whitespace-nowrap">
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
