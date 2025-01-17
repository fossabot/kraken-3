import { Component, OnInit } from '@angular/core'
import { Router, ActivatedRoute, ParamMap } from '@angular/router'
import { Title } from '@angular/platform-browser'

import { MenuItem } from 'primeng/api'

import { ExecutionService } from '../backend/api/execution.service'
import { BreadcrumbsService } from '../breadcrumbs.service'
import { TestCaseResults } from '../test-case-results'
import { datetimeToLocal } from '../utils'

@Component({
    selector: 'app-test-case-result',
    templateUrl: './test-case-result.component.html',
    styleUrls: ['./test-case-result.component.sass'],
})
export class TestCaseResultComponent implements OnInit {
    tcrId = 0
    result = null
    results: any[]
    totalRecords = 0
    loading = false

    // charts
    statusData = {}
    statusOptions = {}
    valueNames: any[]
    selectedValue: any
    valueData: any
    valueOptions = {}
    chartPlugins: any[]
    iterations = 1

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        protected executionService: ExecutionService,
        protected breadcrumbService: BreadcrumbsService,
        private titleService: Title
    ) {}

    ngOnInit() {
        this.valueData = {}

        this.tcrId = parseInt(this.route.snapshot.paramMap.get('id'), 10)
        this.breadcrumbService.setCrumbs([
            {
                label: 'Result',
                tcr_id: this.tcrId,
                tc_name: this.tcrId,
            },
        ])

        this.executionService.getResult(this.tcrId).subscribe((result) => {
            this.result = result
            const crumbs = [
                {
                    label: 'Projects',
                    project_id: this.result.project_id,
                    project_name: this.result.project_name,
                },
                {
                    label: 'Branches',
                    branch_id: this.result.branch_id,
                    branch_name: this.result.branch_name,
                },
                {
                    label: 'Results',
                    branch_id: this.result.branch_id,
                    flow_kind: this.result.flow_kind,
                },
                {
                    label: 'Flows',
                    flow_id: this.result.flow_id,
                },
                {
                    label: 'Stages',
                    run_id: this.result.run_id,
                    run_name: this.result.stage_name,
                },
                {
                    label: 'Result',
                    tcr_id: this.result.id,
                    tc_name: this.result.test_case_name,
                },
            ]
            this.breadcrumbService.setCrumbs(crumbs)

            this.titleService.setTitle(
                'Kraken - Test ' + this.result.test_case_name + ' ' + this.tcrId
            )

            const valueNames = []
            if (result.values) {
                for (const name of Object.keys(result.values)) {
                    valueNames.push({ name })
                }
            }
            this.valueNames = valueNames
            this.selectedValue = valueNames[0]
        })

        this.statusOptions = {
            elements: {
                bar: {
                    backgroundColor: this.statusColors,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Flows',
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: 'Test Case Results',
                    },
                    ticks: {
                        stepSize: 1,
                        callback: (val, idx) => {
                            const resultMapping = {
                                0: 'Not run',
                                1: 'ERROR',
                                2: 'Failed',
                                3: 'Disabled',
                                4: 'Unsupported',
                                5: 'Passed',
                            }
                            return resultMapping[val]
                        },
                    },
                },
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Test case results in flows',
                },
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: (tooltipItem) => {
                            const resultMappingRev = {
                                0: 0, // 'Not run',
                                1: 3, // 'ERROR',
                                2: 2, // 'Failed',
                                3: 4, // 'Disabled',
                                4: 5, // 'Unsupported',
                                5: 1, // 'Passed',
                            }

                            const res = resultMappingRev[tooltipItem.raw]
                            return TestCaseResults.resultToTxt(res)
                        },
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex
                            const data = tooltipItems[0].dataset.origData[idx]
                            return (
                                data.flow_label +
                                ' @ ' +
                                datetimeToLocal(data.flow_created_at, null)
                            )
                        },
                    },
                },
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    }

    statusColors(ctx) {
        const res = ctx.dataset.origData[ctx.dataIndex].result
        return TestCaseResults.resultColor(res)
    }

    resultToChartVal(res) {
        // from most severe to lease severe
        const resultMapping = {
            0: 0, // 'Not run',
            3: 1, // 'ERROR',
            2: 2, // 'Failed',
            4: 3, // 'Disabled',
            5: 4, // 'Unsupported',
            1: 5, // 'Passed',
        }
        return resultMapping[res]
    }

    prepareValueChartData() {
        if (this.results[0].values === null) {
            // no perf data, skip processing
            return
        }

        const lastRes = this.results[0]
        this.iterations = 1
        for (const res of this.results) {
            if (res.values) {
                this.iterations = res.values[this.selectedValue.name].iterations
                break
            }
        }

        const flowLabels = []
        const values = []
        const median = []
        const errorBars = {}
        let errorBarsOk = true
        let minVal = 0
        let maxVal = null
        const origData = []
        for (const res of this.results.slice().reverse()) {
            if (!res.values) {
                continue
            }
            const val = res.values[this.selectedValue.name]
            if (val === undefined || val.value === undefined) {
                continue
            }
            origData.push(res)
            flowLabels.push(res.flow_label)
            values.push(val.value)
            if (val.median) {
                median.push(val.median)
            }
            if (val.stddev !== undefined) {
                errorBars[res.flow_label] = {
                    plus: val.stddev,
                    minus: -val.stddev,
                }

                let v = val.value - val.stddev
                if (minVal > v) {
                    minVal = v
                }
                v = val.value + val.stddev
                if (maxVal == null || maxVal < v) {
                    maxVal = v
                }
            } else {
                errorBarsOk = false
            }
        }

        const valueData = {
            labels: flowLabels,
            datasets: [
                {
                    label: 'value',
                    data: values,
                    origData: origData,
                    fill: false,
                    borderColor: '#f00',
                    backgroundColor: '#f00',
                    lineTension: 0,
                    borderWidth: 2,
                    errorBars: null,
                },
            ],
        }
        if (errorBarsOk) {
            valueData.datasets[0].errorBars = errorBars
        }
        if (median.length > 0) {
            valueData.datasets.push({
                label: 'median',
                data: median,
                origData: origData,
                fill: false,
                borderColor: '#f88',
                backgroundColor: '#f88',
                lineTension: 0,
                borderWidth: 1,
                errorBars: null,
            })
        }
        if (errorBarsOk) {
            valueData.datasets[1].errorBars = {}
        }
        this.valueData = valueData

        this.valueOptions = {
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex
                            const data = tooltipItems[0].dataset.origData[idx]
                            return (
                                data.flow_label +
                                ' @ ' +
                                datetimeToLocal(data.flow_created_at, null)
                            )
                        },
                    },
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Flows',
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: this.selectedValue.name,
                    },
                    ticks: {
                        suggestedMin: minVal,
                        suggestedMax: maxVal,
                    },
                },
            },
        }
    }

    loadResultsLazy(event) {
        this.executionService
            .getResultHistory(this.tcrId, event.first, event.rows)
            .subscribe((data) => {
                this.results = data.items
                this.totalRecords = data.total

                const flowLabels = []
                const statuses = []
                const origData = []
                for (const res of this.results.slice().reverse()) {
                    flowLabels.push(res.flow_label)
                    statuses.push(this.resultToChartVal(res.result))
                    origData.push(res)
                }

                this.statusData = {
                    labels: flowLabels,
                    datasets: [
                        {
                            label: 'Status',
                            data: statuses,
                            origData: origData,
                        },
                    ],
                }

                this.prepareValueChartData()
            })
    }

    formatResult(result) {
        return TestCaseResults.formatResult(result)
    }

    resultToTxt(result) {
        return TestCaseResults.resultToTxt(result)
    }

    resultToClass(result) {
        return 'result' + result
    }

    changeToTxt(change) {
        if (change === 0) {
            return ''
        } else if (change === 1) {
            return 'fix'
        } else {
            return 'regression'
        }
    }

    changeToClass(change) {
        return 'change' + change
    }

    handleTabChange(event) {
        console.info(event)
    }

    valueChange() {
        this.prepareValueChartData()
    }

    showCmdLine() {}
}
