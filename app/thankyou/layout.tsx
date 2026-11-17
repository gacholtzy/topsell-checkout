import AppHeader from "@/components/header"

const ThankYouLayout = ({
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

export default ThankYouLayout;