import AppHeader from "@/components/header"

const TrackingLayout = ({
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

export default TrackingLayout;
