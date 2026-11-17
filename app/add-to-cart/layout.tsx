import { Suspense } from "react"

// Suspense is required: the page reads ?items= with useSearchParams.
const CartLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
    return (
        <div>
            <Suspense fallback={
                <div className="flex justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            }>
                {children}
            </Suspense>
        </div>
    )
}

export default CartLayout;
