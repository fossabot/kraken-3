import { Component, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'

import { AuthService } from '../auth.service'
import { ManagementService } from '../backend/api/management.service'
import { BreadcrumbsService } from '../breadcrumbs.service'

@Component({
    selector: 'app-discovered-page',
    templateUrl: './discovered-page.component.html',
    styleUrls: ['./discovered-page.component.sass'],
})
export class DiscoveredPageComponent implements OnInit {
    agents: any[]
    totalAgents = 0
    loadingAgents = true
    selectedAgents: any[]

    constructor(
        public auth: AuthService,
        protected managementService: ManagementService,
        protected breadcrumbService: BreadcrumbsService,
        private titleService: Title
    ) {}

    ngOnInit() {
        this.titleService.setTitle('Kraken - Discovered Agents')
        const crumbs = [
            {
                label: 'Home',
            },
            {
                label: 'Discovered Agents',
            },
        ]
        this.breadcrumbService.setCrumbs(crumbs)
    }

    loadAgentsLazy(event) {
        this.loadingAgents = true
        console.info(event)

        let sortField = 'name'
        if (event.sortField) {
            sortField = event.sortField
        }
        let sortDir = 'asc'
        if (event.sortOrder === -1) {
            sortDir = 'desc'
        }

        this.managementService
            .getAgents(true, event.first, event.rows, sortField, sortDir)
            .subscribe((data) => {
                this.agents = data.items
                this.totalAgents = data.total
                this.loadingAgents = false
            })
    }

    refreshAgents(agentsTable) {
        agentsTable.onLazyLoad.emit(agentsTable.createLazyLoadMetadata())
    }

    resetAgentsFilter(agentsTable) {
        if (agentsTable) {
            this.refreshAgents(agentsTable)
        }
    }

    agentSelected(ev) {
        console.info(ev)
    }

    authorize(agentsTable) {
        const execs = this.selectedAgents.map((e) => {
            return { id: e.id, authorized: true }
        })
        this.managementService.updateAgents(execs).subscribe((data) => {
            this.refreshAgents(agentsTable)
        })
    }
}
