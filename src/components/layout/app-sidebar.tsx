import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '../../components/ui/sidebar'
import { NavGroup } from '../../components/layout/nav-group'
import { NavUser } from '../../components/layout/nav-user'
import { TeamSwitcher } from '../../components/layout/team-switcher'
import { sidebarData } from './data/sidebar-data'
import { useAuth } from 'wasp/client/auth'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: user, isLoading: isUserLoading } = useAuth()

  const navUserData = user ? {
    name: user.displayName || user.email || 'User',
    email: user.email || 'No email',
    avatar: user.avatarUrl || '',
  } : null

  return (
    <Sidebar collapsible='icon' variant='floating' {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {!isUserLoading && navUserData ? (
          <NavUser user={navUserData} />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">Loading user...</div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
