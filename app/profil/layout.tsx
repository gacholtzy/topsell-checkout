import AppHeader from "@/components/header"

const ProfileLayout = ({
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

export default ProfileLayout;