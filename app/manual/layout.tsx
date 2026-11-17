import AppHeader from "@/components/header"

const ManualLayout = ({
    children
}: {
    children: React.ReactNode
}) => {
    return (
        <div>
            <AppHeader />
            {children}
        </div>
    )
}

export default ManualLayout;