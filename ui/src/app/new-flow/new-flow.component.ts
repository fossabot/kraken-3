import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';

import {TreeNode} from 'primeng/api';
import {MenuItem} from 'primeng/api';
import {MessageService} from 'primeng/api';

import { ManagementService } from '../backend/api/management.service';
import { ExecutionService } from '../backend/api/execution.service';
import { BreadcrumbsService } from '../breadcrumbs.service';

@Component({
  selector: 'app-new-flow',
  templateUrl: './new-flow.component.html',
  styleUrls: ['./new-flow.component.sass']
})
export class NewFlowComponent implements OnInit {

    kind: string
    branchId = 0
    branch: any = {name: ''}
    params: any[]
    args: any

    constructor(private route: ActivatedRoute,
                private router: Router,
                protected managementService: ManagementService,
                protected executionService: ExecutionService,
                protected breadcrumbService: BreadcrumbsService,
                private msgSrv: MessageService) { }

    ngOnInit() {
        this.kind = this.route.snapshot.paramMap.get("kind")

        this.branchId = parseInt(this.route.snapshot.paramMap.get("id"))
        this.managementService.getBranch(this.branchId).subscribe(branch => {
            this.branch = branch

            // prepare breadcrumb
            let crumbs = [{
                label: 'Projects',
                url: '/projects/' + branch.project_id,
                id: branch.project_name
            }, {
                label: 'Branches',
                url: '/branches/' + branch.id,
                id: branch.branch_name
            }];
            this.breadcrumbService.setCrumbs(crumbs);

            // prepare args form
            let args = {'Common': {BRANCH: branch.branch_name}}
            let params = []

            if (this.kind == 'dev') {
                params.push({
                    name: 'Common',
                    params: [{
                        name: 'BRANCH',
                        'type': 'string'
                    }]
                })
            }

            for (let s of branch.stages) {
                if (s.schema.parent != 'root' || s.schema.triggers.parent === false) {
                    continue;
                }
                params.push({
                    name: s.name,
                    params: s.schema.parameters
                })
                args[s.name] = {}
                for (let p of s.schema.parameters) {
                    args[s.name][p.name] = p['default']
                }
            }
            this.params = params
            this.args = args
        })
    }

    submitFlow() {
        let flow = {
            args: this.args,
        }
        this.executionService.createFlow(this.branchId, this.kind, flow).subscribe(flow => {
            //console.info(flow)
            this.router.navigate(['/flows/' + flow.id]);
        });
    }
}