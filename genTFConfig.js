'use strict';

var Promise = require('bluebird')
var fs = require("fs");
var fsp = Promise.promisifyAll(fs)
var targVcpu = 1
var targVcpuEnv = process.env['ASR_TARG_VCPU']
if (targVcpuEnv && targVcpuEnv > 0) {
    targVcpu = targVcpuEnv
}
var testAMI = process.env['ASR_TEST_AMI']

var instTypes = ['m4.large']
var instTypeStr = process.env['ASR_INST_TYPES']
if (instTypeStr) {
    instTypes = instTypeStr.split(',')
}
var availZonesStr = 'us-east-1a,us-east-1b,us-east-1c,us-east-1d,us-east-1e,us-east-1f'
var availZonesEnvStr = process.env['ASR_AVAIL_ZONES']
if (availZonesEnvStr) {
    availZonesStr = availZonesEnvStr
}
var availZones = availZonesStr.split(',')



var region = 'us-east-1'
var regionEnv = process.env['AWS_REGION']
if (regionEnv) {
    region = regionEnv
}
var terraWksp = process.env['TERRA_WKSP']

var exec = require('child_process').exec;

var vCpuMap = {}
var priceMap = {}

function loadInstParams() {
    return Promise.map(instTypes, function(iType) {
        return loadInstParamsFor(iType)
    })
}

function loadInstParamsFor(iType) {
    return loadInstPrice(iType)
        .then(function(d) {
            return loadInstVCpus(iType)
        })
}

function loadInstPrice(iType) {
    return new Promise(function(resolve, reject) {
        exec('cat data/LinuxOnDemandPrices.csv | grep '+iType+' | grep '+region,
            function (error, stdout, stderr) {
                var resp = `${stdout}`
                var fields = resp.split(',')
                var price
                if (fields.length > 3) {
                    price = +fields[3]
                }
                priceMap[iType] = price
                if (error === null) {
                    resolve(price)
                } else {
                    console.log(`${stderr}`)
                    console.log(`exec error: ${error}`)
                    reject(error)
                }
            })
    })
}

function loadInstVCpus(iType) {
    return new Promise(function (resolve, reject) {
        exec('cat data/LinuxInstanceSpecs.csv | grep ' + iType + ' | grep ' + region,
            function (error, stdout, stderr) {
                var resp = `${stdout}`
                //console.log('resp:' + resp)
                var fields = resp.split(',')
                var vCpus
                if (fields.length > 3) {
                    vCpus = +fields[3]
                }
                vCpuMap[iType] = vCpus
                if (error === null) {
                    resolve(vCpus)
                } else {
                    console.log(`${stderr}`)
                    console.log(`exec error: ${error}`)
                    reject(error)
                }
            })
    })
}

function buildTerraFile() {
    var fCont = ' provider "aws" { \n'
    fCont += '     region = "us-east-1" \n'
    fCont += ' } \n'
    fCont += ' provider "autoscalr" { \n'
    fCont += ' } \n'
    fCont += ' resource "aws_launch_configuration" "test_lc" { \n'
    fCont += '     name_prefix   = "test-lc-" \n'
    fCont += '     image_id      = "' + testAMI + '" \n'
    fCont += '     instance_type = "m3.medium" \n'
    fCont += '     lifecycle { \n'
    fCont += '         create_before_destroy = true \n'
    fCont += '     } \n'
    fCont += ' } \n'
    fCont += ' resource "aws_autoscaling_group" "autoscalr_test_ASG" { \n'
    fCont += '     availability_zones = ' + JSON.stringify(availZones) + ' \n'
    fCont += '     name_prefix   = "test-asg-" \n'
    fCont += '     max_size = 10 \n'
    fCont += '     min_size = 0 \n'
    fCont += '     health_check_grace_period = 300 \n'
    fCont += '     health_check_type = "EC2" \n'
    fCont += '     force_delete = true \n'
    fCont += '     launch_configuration = "${aws_launch_configuration.test_lc.name}" \n'
    fCont += '     lifecycle { \n'
    fCont += '         create_before_destroy = true \n'
    fCont += '     } \n'
    fCont += '     suspended_processes = ["AZRebalance"] \n'
    fCont += ' } \n'
    fCont += ' resource "autoscalr_autoscaling_group" "asr4MyExampleASG" { \n'
    fCont += '     aws_region = "us-east-1" \n'
    fCont += '     aws_autoscaling_group_name = "${aws_autoscaling_group.autoscalr_test_ASG.name}" \n'
    fCont += '     display_name = "Fleet Benchmark" \n'
    fCont += '     scale_mode = "fixed" \n'
    fCont += '     target_capacity = '+targVcpu+' \n'
    fCont += '     instance_types = '+ JSON.stringify(instTypes) + ' \n'
    fCont += '     max_spot_percent_total = 100 \n'
    fCont += '     max_spot_percent_one_market = 100 \n'
    fCont += ' } \n'
    fCont += '   \n'
    fCont += ' resource "aws_iam_role" "fleet" { \n'
    fCont += '     assume_role_policy = "{ \\"Version\\": \\"2008-10-17\\", \\"Statement\\": [ { \\"Sid\\": \\"\\",\\"Effect\\": \\"Allow\\",\\"Principal\\": {\\"Service\\": [ \\"spotfleet.amazonaws.com\\",\\"ec2.amazonaws.com\\" ] },\\"Action\\": \\"sts:AssumeRole\\"}]}"\n'
    fCont += ' } \n'
    fCont += ' resource "aws_iam_policy_attachment" "fleet" { \n'
    fCont += '     name       = "policy_for_${aws_iam_role.fleet.name}" \n'
    fCont += '     roles      = ["${aws_iam_role.fleet.name}"] \n'
    fCont += '     policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole" \n'
    fCont += ' } \n'
    fCont += ' resource "aws_spot_fleet_request" "spotFleet" { \n'
    fCont += '     iam_fleet_role      = "${aws_iam_role.fleet.arn}" \n'
    fCont += '     spot_price          = "0.5" \n'
    fCont += '     allocation_strategy = "diversified" \n'
    fCont += '     target_capacity     = '+targVcpu+' \n'
    fCont += '     valid_until         = "2019-11-04T20:44:20Z" \n'
    fCont += '     terminate_instances_with_expiration = true \n'
    // create a launch specification for each instance type
    instTypes.forEach(function(iType) {
        var spotBid = 0.001
        if (vCpuMap[iType]) {
            spotBid = priceMap[iType] / vCpuMap[iType]
        }
        fCont += '     launch_specification { \n'
        fCont += '         instance_type     = "' + iType + '" \n'
        fCont += '         ami               = "' + testAMI + '" \n'
        fCont += '         spot_price        = ' + spotBid + ' \n'
        fCont += '         weighted_capacity = ' + vCpuMap[iType] + ' \n'
        fCont += '         tags              = { \n'
        fCont += '             FleetManager = "SpotFleet" \n'
        fCont += '         } \n'
        fCont += '     } \n'
    })
    fCont += ' } \n'
    return fCont
}

loadInstParams()
    .then(function(d) {
        var tfFileCont = buildTerraFile()
        fsp.writeFileAsync(terraWksp+'/main.tf', tfFileCont)
            .then(function(d) {
                console.log('Terraform file generated')
            })
    })


