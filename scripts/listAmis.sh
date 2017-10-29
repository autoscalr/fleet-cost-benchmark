#!/usr/bin/env bash
for region in $(aws ec2 describe-regions --query "Regions[].RegionName" --output json | jq -r '.[]'); do
echo "$region = $(aws ec2 describe-images --owners amazon --filters 'Name=name,Values=amzn-ami-hvm-????.??.?.x86_64-gp2' --query 'sort_by(Images, &CreationDate) | [-1].ImageId' --region $region)"
done