import AppHeader from "@/components/header"

const PointsLayout = ({
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

export default PointsLayout; 