"use client";
import React from 'react';
import { Check, MapPin, ChevronLeft } from 'lucide-react';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';
import { AddressSearchResult } from '../interface/address';

interface AddressSearchProps {
    /** Text of the current pick; non-empty means a district + postal code is chosen. */
    value?: string;
    /** Typing or "Ubah" voids the pick: the caller clears its destination id. */
    onChange?: (value: string) => void;
    /** Called with the final pick: a district area id carrying its postal code. */
    onSelect?: (address: AddressSearchResult) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

// Every search is a billed Biteship Maps request, so the box waits for the
// customer to pause and for at least three characters.
const SEARCH_DEBOUNCE_MS = 500;
const MIN_KEYWORD_LENGTH = 3;

/**
 * Two-step area picker, following Biteship's own hierarchy:
 *
 *  1. type a district or city, pick the district (kecamatan). The list comes
 *     from the API's embedded Permendagri index (mode=local), so typing a city
 *     shows every one of its districts; Biteship's own search stops at ten
 *     rows and repeats districts per postal code.
 *  2. pick its postal code from the list Biteship returns for that district.
 *     The API resolves the picked names to the Biteship area first.
 *
 * The final pick carries the full Biteship area id (…IDZ<postal>) the rate
 * quote and the order use. A district with a single postal code skips step 2.
 */
export function AddressSearch({
    value = '',
    onChange,
    onSelect,
    placeholder = "Cari kecamatan...",
    disabled = false,
    className,
}: AddressSearchProps) {
    const [keyword, setKeyword] = React.useState('');
    const [results, setResults] = React.useState<AddressSearchResult[]>([]);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    // Step 2 state: the district picked and the postal codes Biteship lists for it.
    const [district, setDistrict] = React.useState<AddressSearchResult | null>(null);
    const [postalOptions, setPostalOptions] = React.useState<AddressSearchResult[]>([]);
    const [postalLoading, setPostalLoading] = React.useState(false);
    const [postalError, setPostalError] = React.useState<string | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    React.useEffect(() => {
        const term = keyword.trim();
        if (term.length < MIN_KEYWORD_LENGTH) {
            setResults([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await fetch(`/backend/address/search?mode=local&search=${encodeURIComponent(term)}&limit=300&offset=0`);
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    throw new Error(data?.message || `search failed: ${res.status}`);
                }
                setResults(Array.isArray(data?.data) ? data.data : []);
            } catch (e) {
                if (cancelled) return;
                console.error('address search failed', e);
                setResults([]);
                setError('Pencarian alamat gagal. Coba lagi sebentar.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [keyword]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value || '';
        setKeyword(text);
        onChange?.(text);
        setIsOpen(text.trim().length >= MIN_KEYWORD_LENGTH);
    };

    const finish = (pick: AddressSearchResult) => {
        setKeyword('');
        setResults([]);
        setIsOpen(false);
        setDistrict(null);
        setPostalOptions([]);
        onSelect?.(pick);
    };

    // Step 1 -> 2: a district is picked, ask the API for its postal codes.
    // Rows from the local index have no Biteship id yet, so the names go up
    // and the API resolves them; a row that already has an id is used as is.
    const handleSelectDistrict = async (picked: AddressSearchResult) => {
        const districtName = picked?.district_name || picked?.subdistrict_name;
        if (!picked || (!picked.id && !districtName)) return;
        setIsOpen(false);
        setDistrict(picked);
        setPostalOptions([]);
        setPostalError(null);
        setPostalLoading(true);
        try {
            const query = picked.id
                ? `area_id=${encodeURIComponent(picked.id)}`
                : `district=${encodeURIComponent(districtName || '')}&city=${encodeURIComponent(picked.city_name || '')}&province=${encodeURIComponent(picked.province_name || '')}`;
            const res = await fetch(`/backend/address/postal-codes?${query}`);
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(res.status === 404
                    ? (data?.message || 'Kecamatan ini belum dikenali oleh layanan kurir. Coba pilih kecamatan terdekat.')
                    : (data?.message || `postal codes failed: ${res.status}`));
            }
            const options: AddressSearchResult[] = Array.isArray(data?.data) ? data.data : [];
            if (options.length === 1) {
                finish(options[0]);
                return;
            }
            if (options.length === 0) {
                if (!picked.id) {
                    throw new Error('Kode pos untuk kecamatan ini tidak tersedia di layanan kurir.');
                }
                // Biteship knows no postal code for it: the district id alone
                // still addresses a quote and an order.
                finish({ ...picked, zip_code: '' });
                return;
            }
            setPostalOptions(options);
        } catch (e) {
            console.error('postal codes failed', e);
            setPostalError(e instanceof Error && e.message ? e.message : 'Gagal memuat kode pos. Coba pilih kecamatan lagi.');
        } finally {
            setPostalLoading(false);
        }
    };

    const handleEdit = () => {
        onChange?.('');
        setKeyword('');
        setIsOpen(false);
        setDistrict(null);
        setPostalOptions([]);
    };

    if (value) {
        return (
            <div className={cn("flex flex-col", className)}>
                <div className="border rounded-md p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center mb-1">
                                <Check className="h-4 w-4 text-green-600 mr-2" />
                                <span className="text-sm font-medium text-green-600">Alamat Terpilih</span>
                            </div>
                            <p className="text-sm text-gray-700 break-words">{value}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleEdit}
                            disabled={disabled}
                            className="ml-2 px-2 py-1 text-xs border rounded hover:bg-gray-100 text-gray-600"
                        >
                            Ubah
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: postal code list for the picked district.
    if (district) {
        const districtLabel = [district.district_name || district.subdistrict_name, district.city_name, district.province_name].filter(Boolean).join(', ');
        return (
            <div className={cn("flex flex-col", className)}>
                <div className="border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-sm text-gray-700 min-w-0">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                            <span className="truncate">{districtLabel}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleEdit}
                            className="ml-2 inline-flex items-center px-2 py-1 text-xs border rounded hover:bg-gray-100 text-gray-600"
                        >
                            <ChevronLeft className="h-3 w-3 mr-1" /> Ganti kecamatan
                        </button>
                    </div>
                    <p className="text-sm font-medium mb-2">Pilih kode pos</p>
                    {postalLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : postalError ? (
                        <p className="text-sm text-red-600">{postalError}</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[180px] overflow-y-auto">
                            {postalOptions.map((option) => (
                                <button
                                    type="button"
                                    key={option.id}
                                    onClick={() => finish(option)}
                                    className="border rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 text-center"
                                >
                                    {option.zip_code}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Step 1: district search.
    return (
        <div className={cn("flex flex-col", className)} ref={dropdownRef}>
            <div className="relative">
                <Input
                    value={keyword}
                    onChange={handleInputChange}
                    onFocus={() => keyword.trim().length >= MIN_KEYWORD_LENGTH && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                    className="w-full"
                />
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[320px] overflow-y-auto overscroll-contain">
                        {results.length > 0 && (
                            <div className="sticky top-0 bg-white border-b px-2 py-1 text-xs text-gray-500">
                                {results.length} kecamatan ditemukan{results.length > 8 ? ', gulir untuk melihat semua' : ''}
                            </div>
                        )}
                        <div className="py-1">
                            {isLoading && results.length === 0 ? (
                                <>
                                    <div className="px-2 py-1.5"><Skeleton className="h-4 w-[220px]" /></div>
                                    <div className="px-2 py-1.5"><Skeleton className="h-4 w-[180px]" /></div>
                                    <div className="px-2 py-1.5"><Skeleton className="h-4 w-[200px]" /></div>
                                </>
                            ) : results.length > 0 ? (
                                results.map((address, index) => (
                                    <button
                                        type="button"
                                        key={address.id || `${address.district_name}-${address.city_name}-${index}`}
                                        className="w-full px-2 py-1.5 text-left hover:bg-gray-100 flex items-center text-sm"
                                        onClick={() => handleSelectDistrict(address)}
                                    >
                                        <MapPin className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                                        <span className="truncate">
                                            {[address.district_name || address.subdistrict_name, address.city_name, address.province_name].filter(Boolean).join(', ')}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-sm text-gray-500">
                                    {keyword.trim().length < MIN_KEYWORD_LENGTH
                                        ? `Ketik minimal ${MIN_KEYWORD_LENGTH} karakter untuk mencari kecamatan`
                                        : error || "Tidak ada hasil ditemukan"}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <p className="mt-1 text-xs text-gray-500">Ketik nama kecamatan atau kota, pilih kecamatannya, lalu pilih kode pos.</p>
        </div>
    );
}
