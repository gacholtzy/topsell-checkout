import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Check, ChevronDownIcon } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

interface SearchableDropdownProps<T> {
    label: string;
    value: string;
    options: T[];
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
    displayValue: (item: T) => string;
    onSelect: (item: T) => void;
    onOpenChange: (open: boolean) => void;
    isOpen: boolean;
    className?: string;
    getValue?: (item: T) => string;
}

export function SearchableDropdown<T>({
    label,
    value,
    options,
    isLoading = false,
    disabled = false,
    placeholder = "Pilih...",
    searchPlaceholder = "Cari...",
    displayValue,
    onSelect,
    onOpenChange,
    isOpen,
    className,
    getValue = displayValue
}: SearchableDropdownProps<T>) {
    const [filteredOptions, setFilteredOptions] = React.useState(options);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setFilteredOptions(options);
    }, [options]);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onOpenChange(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onOpenChange]);

    const selectedOption = React.useMemo(() => {
        return options.find(option => getValue(option) === value);
    }, [options, value, getValue]);

    return (
        <div className={cn("flex flex-col", className)} ref={dropdownRef}>
            <label className="text-sm font-medium mb-1">{label}</label>
            <div className="relative">
                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    disabled={disabled}
                    onClick={() => onOpenChange(!isOpen)}
                >
                    {selectedOption ? displayValue(selectedOption) : placeholder}
                    <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b p-2">
                            <Input
                                placeholder={searchPlaceholder}
                                className="mb-0"
                                onChange={(e) => {
                                    const search = e.target.value.toLowerCase();
                                    const filtered = options.filter(option =>
                                        displayValue(option).toLowerCase().includes(search)
                                    );
                                    setFilteredOptions(filtered);
                                }}
                            />
                        </div>
                        <div className="py-1">
                            {isLoading ? (
                                <>
                                    <div className="px-2 py-1.5 flex items-center space-x-2">
                                        <Skeleton className="h-4 w-[200px]" />
                                    </div>
                                    <div className="px-2 py-1.5 flex items-center space-x-2">
                                        <Skeleton className="h-4 w-[200px]" />
                                    </div>
                                    <div className="px-2 py-1.5 flex items-center space-x-2">
                                        <Skeleton className="h-4 w-[200px]" />
                                    </div>
                                </>
                            ) : (
                                filteredOptions.map((option) => (
                                    <button
                                        key={getValue(option)}
                                        className="w-full px-2 py-1.5 text-left hover:bg-gray-100 flex items-center"
                                        onClick={() => onSelect(option)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                getValue(option) === value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {displayValue(option)}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 